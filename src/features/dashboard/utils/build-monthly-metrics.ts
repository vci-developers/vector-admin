import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Program } from '@/api/program/validation/program-schema';
import {
    checkRecordFields,
    REQUIRED_FIELDS,
    type RequiredField,
} from './check-record-fields';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { hasCountryBox } from './country-bounding-boxes';
import type { ResolvedRange } from './resolve-reporting-range';
import {
    monthKeyOf,
    monthsInRange,
    programTimeZone,
    type MonthKey,
} from './month-key';

export type MonthCounts = {
    activeDevices: number;
    scans: number;
    uniqueSpecimens: number;
    records: number;
    completeRecords: number;
    fieldPasses: Record<RequiredField, number>;
    certifiedSessions: number;
    submittedSessions: number;
};

/** Ratios are null when their denominator is 0, so blanks never read as 0. */
export type MonthMetrics = MonthCounts & {
    scansPerActiveDevice: number | null;
    metadataCompleteness: number | null;
    fieldCompleteness: Record<RequiredField, number | null>;
    dhis2UploadRate: number | null;
};

export type ProgramMonthlyMetrics = {
    programId: number;
    hasCountryBox: boolean;
    months: Record<MonthKey, MonthMetrics>;
    cycleLabels: Record<MonthKey, number[]>;
};

export type MonthlyMetrics = {
    months: MonthKey[];
    programs: ProgramMonthlyMetrics[];
    totals: Record<MonthKey, MonthMetrics>;
};

export type ProgramData = { program: Program; snapshot: ProgramSnapshot };

function emptyCounts(): MonthCounts {
    return {
        activeDevices: 0,
        scans: 0,
        uniqueSpecimens: 0,
        records: 0,
        completeRecords: 0,
        fieldPasses: {
            species: 0,
            captureDate: 0,
            geolocation: 0,
            operatorId: 0,
        },
        certifiedSessions: 0,
        submittedSessions: 0,
    };
}

const ratio = (numerator: number, denominator: number) =>
    denominator === 0 ? null : numerator / denominator;

function withRatios(counts: MonthCounts): MonthMetrics {
    return {
        ...counts,
        scansPerActiveDevice: ratio(counts.scans, counts.activeDevices),
        metadataCompleteness: ratio(counts.completeRecords, counts.records),
        fieldCompleteness: {
            species: ratio(counts.fieldPasses.species, counts.records),
            captureDate: ratio(counts.fieldPasses.captureDate, counts.records),
            geolocation: ratio(counts.fieldPasses.geolocation, counts.records),
            operatorId: ratio(counts.fieldPasses.operatorId, counts.records),
        },
        dhis2UploadRate: ratio(
            counts.submittedSessions,
            counts.certifiedSessions + counts.submittedSessions,
        ),
    };
}

function addCounts(total: MonthCounts, counts: MonthCounts) {
    total.activeDevices += counts.activeDevices;
    total.scans += counts.scans;
    total.uniqueSpecimens += counts.uniqueSpecimens;
    total.records += counts.records;
    total.completeRecords += counts.completeRecords;
    total.certifiedSessions += counts.certifiedSessions;
    total.submittedSessions += counts.submittedSessions;
    for (const field of REQUIRED_FIELDS) {
        total.fieldPasses[field] += counts.fieldPasses[field];
    }
}

function countProgramMonths(
    { program, snapshot }: ProgramData,
    months: MonthKey[],
    timeZone: string,
): Map<MonthKey, MonthCounts> {
    const counts = new Map(months.map(month => [month, emptyCounts()]));
    const activeDevices = new Map(
        months.map(month => [month, new Set<number>()]),
    );
    const sessions = new Map(
        snapshot.sessions.filter(isCountedSession).map(session => [
            session.sessionId,
            {
                session,
                month: monthKeyOf(sessionBucketTime(session), timeZone),
            },
        ]),
    );

    for (const { session, month } of sessions.values()) {
        const monthCounts = counts.get(month);
        if (!monthCounts) continue;
        activeDevices.get(month)?.add(session.deviceId);
        if (session.state === 'CERTIFIED') monthCounts.certifiedSessions += 1;
        if (session.state === 'SUBMITTED') monthCounts.submittedSessions += 1;
    }

    for (const specimen of snapshot.specimens) {
        const entry = sessions.get(specimen.sessionId);
        const monthCounts = entry && counts.get(entry.month);
        if (!entry || !monthCounts) continue;

        const checks = checkRecordFields(
            specimen,
            entry.session,
            program.country,
        );
        monthCounts.uniqueSpecimens += 1;
        monthCounts.scans += specimen.images.length;
        monthCounts.records += 1;
        if (REQUIRED_FIELDS.every(field => checks[field])) {
            monthCounts.completeRecords += 1;
        }
        for (const field of REQUIRED_FIELDS) {
            if (checks[field]) monthCounts.fieldPasses[field] += 1;
        }
    }

    for (const [month, devices] of activeDevices) {
        const monthCounts = counts.get(month);
        if (monthCounts) monthCounts.activeDevices = devices.size;
    }
    return counts;
}

function buildCycleLabels(
    snapshot: ProgramSnapshot,
    months: MonthKey[],
    timeZone: string,
): Record<MonthKey, number[]> {
    const labels: Record<MonthKey, number[]> = Object.fromEntries(
        months.map(month => [month, []]),
    );
    for (const cycle of snapshot.collectionCycles) {
        const first = monthKeyOf(cycle.startDate, timeZone);
        // endDate is the next cycle's start, so the cycle ends just before it
        const last = monthKeyOf(cycle.endDate - 1, timeZone);
        for (const month of months) {
            if (month >= first && month <= last)
                labels[month].push(cycle.cycleNumber);
        }
    }
    return labels;
}

function earliestDataMonth(programs: ProgramData[]): MonthKey | undefined {
    const firstMonths = programs.flatMap(({ snapshot }) => {
        const timeZone = programTimeZone(snapshot.collectionCycles);
        return snapshot.sessions
            .filter(isCountedSession)
            .map(session => monthKeyOf(sessionBucketTime(session), timeZone));
    });
    return firstMonths.reduce<MonthKey | undefined>(
        (earliest, month) => (!earliest || month < earliest ? month : earliest),
        undefined,
    );
}

export function buildMonthlyMetrics(
    programs: ProgramData[],
    range: ResolvedRange,
): MonthlyMetrics {
    const from = range.from ?? earliestDataMonth(programs) ?? range.to;
    const months = monthsInRange(from, range.to);
    const totals = new Map(months.map(month => [month, emptyCounts()]));

    const programMetrics = programs.map(programData => {
        const timeZone = programTimeZone(programData.snapshot.collectionCycles);
        const counts = countProgramMonths(programData, months, timeZone);
        for (const [month, monthCounts] of counts) {
            const total = totals.get(month);
            if (total) addCounts(total, monthCounts);
        }
        return {
            programId: programData.program.programId,
            hasCountryBox: hasCountryBox(programData.program.country),
            months: Object.fromEntries(
                [...counts].map(([month, monthCounts]) => [
                    month,
                    withRatios(monthCounts),
                ]),
            ),
            cycleLabels: buildCycleLabels(
                programData.snapshot,
                months,
                timeZone,
            ),
        };
    });

    return {
        months,
        programs: programMetrics,
        totals: Object.fromEntries(
            [...totals].map(([month, monthCounts]) => [
                month,
                withRatios(monthCounts),
            ]),
        ),
    };
}
