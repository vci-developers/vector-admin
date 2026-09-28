import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Program } from '@/api/program/validation/program-schema';
import {
    checkRecordFields,
    REQUIRED_FIELDS,
    type RequiredField,
} from './check-record-fields';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { hasCountryBox } from './country-bounding-boxes';
import {
    addMonths,
    monthKeyOf,
    monthsInRange,
    programTimeZone,
    type MonthKey,
} from './month-key';
import type { ResolvedRange } from './resolve-reporting-range';

export type PeriodCounts = {
    /** Devices with ≥1 Session in the period, each counted once. */
    activeDevices: number;
    scans: number;
    uniqueSpecimens: number;
    records: number;
    completeRecords: number;
    fieldPasses: Record<RequiredField, number>;
    certifiedSessions: number;
    submittedSessions: number;
    /** VectorVerify users who logged in during the period, each counted once. */
    uniqueUsers: number;
    logins: number;
};

/**
 * Ratios are null when their denominator is 0, and user counts are null when
 * the period ends before login tracking began, so blanks never read as 0.
 */
export type PeriodMetrics = Omit<PeriodCounts, 'uniqueUsers' | 'logins'> & {
    uniqueUsers: number | null;
    logins: number | null;
    scansPerActiveDevice: number | null;
    metadataCompleteness: number | null;
    fieldCompleteness: Record<RequiredField, number | null>;
    dhis2UploadRate: number | null;
};

export type ProgramPeriodMetrics = {
    programId: number;
    hasCountryBox: boolean;
    metrics: PeriodMetrics;
    /** Collection Cycles overlapping the period. */
    cycles: number[];
};

export type DashboardMetrics = {
    from: MonthKey;
    to: MonthKey;
    programs: ProgramPeriodMetrics[];
    total: PeriodMetrics;
    /** The same-length period just before; null for All time. */
    previousTotal: PeriodMetrics | null;
};

export type ProgramData = { program: Program; snapshot: ProgramSnapshot };

type Period = { from: MonthKey; to: MonthKey };

const inPeriod = (month: MonthKey, { from, to }: Period) =>
    month >= from && month <= to;

function emptyCounts(): PeriodCounts {
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
        uniqueUsers: 0,
        logins: 0,
    };
}

const ratio = (numerator: number, denominator: number) =>
    denominator === 0 ? null : numerator / denominator;

function withRatios(
    counts: PeriodCounts,
    loginsTracked: boolean,
): PeriodMetrics {
    return {
        ...counts,
        uniqueUsers: loginsTracked ? counts.uniqueUsers : null,
        logins: loginsTracked ? counts.logins : null,
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

// Devices and users belong to one Program, so per-Program distinct counts add up.
function addCounts(total: PeriodCounts, counts: PeriodCounts) {
    total.activeDevices += counts.activeDevices;
    total.scans += counts.scans;
    total.uniqueSpecimens += counts.uniqueSpecimens;
    total.records += counts.records;
    total.completeRecords += counts.completeRecords;
    total.certifiedSessions += counts.certifiedSessions;
    total.submittedSessions += counts.submittedSessions;
    total.uniqueUsers += counts.uniqueUsers;
    total.logins += counts.logins;
    for (const field of REQUIRED_FIELDS) {
        total.fieldPasses[field] += counts.fieldPasses[field];
    }
}

function countProgram(
    { program, snapshot }: ProgramData,
    period: Period,
): PeriodCounts {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const counts = emptyCounts();
    const activeDevices = new Set<number>();
    const sessions = new Map(
        snapshot.sessions
            .filter(
                session =>
                    isCountedSession(session) &&
                    inPeriod(
                        monthKeyOf(sessionBucketTime(session), timeZone),
                        period,
                    ),
            )
            .map(session => [session.sessionId, session]),
    );

    for (const session of sessions.values()) {
        activeDevices.add(session.deviceId);
        if (session.state === 'CERTIFIED') counts.certifiedSessions += 1;
        if (session.state === 'SUBMITTED') counts.submittedSessions += 1;
    }
    counts.activeDevices = activeDevices.size;

    for (const specimen of snapshot.specimens) {
        const session = sessions.get(specimen.sessionId);
        if (!session) continue;
        const checks = checkRecordFields(specimen, session, program.country);
        counts.uniqueSpecimens += 1;
        counts.scans += specimen.images.length;
        counts.records += 1;
        if (REQUIRED_FIELDS.every(field => checks[field]))
            counts.completeRecords += 1;
        for (const field of REQUIRED_FIELDS) {
            if (checks[field]) counts.fieldPasses[field] += 1;
        }
    }

    // The backend buckets logins by UTC day, so these use UTC months.
    for (const user of snapshot.userLogins) {
        const loginsInPeriod = user.dailyLogins
            .filter(({ date }) => inPeriod(date.slice(0, 7), period))
            .reduce((sum, { count }) => sum + count, 0);
        if (loginsInPeriod > 0) counts.uniqueUsers += 1;
        counts.logins += loginsInPeriod;
    }
    return counts;
}

function overlappingCycles(
    snapshot: ProgramSnapshot,
    period: Period,
): number[] {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    return snapshot.collectionCycles
        .filter(cycle => {
            const first = monthKeyOf(cycle.startDate, timeZone);
            // endDate is the next cycle's start, so the cycle ends just before it
            const last = monthKeyOf(cycle.endDate - 1, timeZone);
            return first <= period.to && last >= period.from;
        })
        .map(cycle => cycle.cycleNumber);
}

function earliestDataMonth(programs: ProgramData[]): MonthKey | undefined {
    const months = programs.flatMap(({ snapshot }) => {
        const timeZone = programTimeZone(snapshot.collectionCycles);
        return snapshot.sessions
            .filter(isCountedSession)
            .map(session => monthKeyOf(sessionBucketTime(session), timeZone));
    });
    return months.reduce<MonthKey | undefined>(
        (earliest, month) => (!earliest || month < earliest ? month : earliest),
        undefined,
    );
}

// The backend only records logins from when auth events shipped; a period that
// ends before the first recorded login anywhere in the selection is unknown.
function firstLoginMonth(programs: ProgramData[]): MonthKey | null {
    const dates = programs.flatMap(({ snapshot }) =>
        snapshot.userLogins.flatMap(user => user.dailyLogins.map(d => d.date)),
    );
    return dates.length
        ? dates.reduce((a, b) => (a < b ? a : b)).slice(0, 7)
        : null;
}

function totalFor(programs: ProgramData[], period: Period): PeriodCounts {
    const total = emptyCounts();
    for (const programData of programs)
        addCounts(total, countProgram(programData, period));
    return total;
}

export function buildPeriodMetrics(
    programs: ProgramData[],
    range: ResolvedRange,
): DashboardMetrics {
    const period = {
        from: range.from ?? earliestDataMonth(programs) ?? range.to,
        to: range.to,
    };
    const loginStart = firstLoginMonth(programs);
    const loginsTracked = (p: Period) =>
        loginStart !== null && p.to >= loginStart;

    const programMetrics = programs.map(programData => ({
        programId: programData.program.programId,
        hasCountryBox: hasCountryBox(programData.program.country),
        metrics: withRatios(
            countProgram(programData, period),
            loginsTracked(period),
        ),
        cycles: overlappingCycles(programData.snapshot, period),
    }));

    const length = monthsInRange(period.from, period.to).length;
    const previous = range.from
        ? {
              from: addMonths(period.from, -length),
              to: addMonths(period.from, -1),
          }
        : null;

    return {
        ...period,
        programs: programMetrics,
        total: withRatios(totalFor(programs, period), loginsTracked(period)),
        previousTotal: previous
            ? withRatios(totalFor(programs, previous), loginsTracked(previous))
            : null,
    };
}
