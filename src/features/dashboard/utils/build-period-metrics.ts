import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Program } from '@/api/program/validation/program-schema';
import type { Session } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import {
    timeSessionImages,
    timingStats,
    type TimingStats,
} from './build-handling-time';
import {
    checkRecordFields,
    REQUIRED_FIELDS,
    type RequiredField,
} from './check-record-fields';
import { sessionBucketTime } from './counted-sessions';
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
    images: number;
    uniqueSpecimens: number;
    records: number;
    completeRecords: number;
    fieldPasses: Record<RequiredField, number>;
    /** Records in DHIS2 countries, the DHIS2 Upload Rate's denominator. */
    dhis2Records: number;
    /** Of those, Records whose Session is Submitted (sent to DHIS2). */
    submittedRecords: number;
    /** Seconds between consecutive images within each Session, pooled. */
    imageGaps: number[];
    /** VectorVerify users who logged in during the period, each counted once. */
    uniqueUsers: number;
    logins: number;
};

/**
 * Ratios are null when their denominator is 0, and user counts are null when
 * the period ends before login tracking began, so blanks never read as 0.
 */
export type PeriodMetrics = Omit<
    PeriodCounts,
    'uniqueUsers' | 'logins' | 'imageGaps'
> & {
    uniqueUsers: number | null;
    logins: number | null;
    imagesPerActiveDevice: number | null;
    metadataCompleteness: number | null;
    fieldCompleteness: Record<RequiredField, number | null>;
    dhis2UploadRate: number | null;
    /** Time between images; null with no gap to time. */
    timing: TimingStats | null;
};

export type ProgramPeriodMetrics = {
    programId: number;
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

export type Period = { from: MonthKey; to: MonthKey };

// Only Uganda uploads to DHIS2; the API has no per-Program setting. Elsewhere
// every Session would stay Certified and read as a 0% upload rate.
const DHIS2_COUNTRIES = ['Uganda'];

export const inPeriod = (month: MonthKey, { from, to }: Period) =>
    month >= from && month <= to;

export function emptyCounts(): PeriodCounts {
    return {
        activeDevices: 0,
        images: 0,
        uniqueSpecimens: 0,
        records: 0,
        completeRecords: 0,
        fieldPasses: {
            species: 0,
            captureDate: 0,
            geolocation: 0,
            operatorId: 0,
        },
        dhis2Records: 0,
        submittedRecords: 0,
        imageGaps: [],
        uniqueUsers: 0,
        logins: 0,
    };
}

const ratio = (numerator: number, denominator: number) =>
    denominator === 0 ? null : numerator / denominator;

export function withRatios(
    { imageGaps, ...counts }: PeriodCounts,
    loginsTracked: boolean,
): PeriodMetrics {
    return {
        ...counts,
        uniqueUsers: loginsTracked ? counts.uniqueUsers : null,
        logins: loginsTracked ? counts.logins : null,
        imagesPerActiveDevice: ratio(counts.images, counts.activeDevices),
        metadataCompleteness: ratio(counts.completeRecords, counts.records),
        fieldCompleteness: {
            species: ratio(counts.fieldPasses.species, counts.records),
            captureDate: ratio(counts.fieldPasses.captureDate, counts.records),
            geolocation: ratio(counts.fieldPasses.geolocation, counts.records),
            operatorId: ratio(counts.fieldPasses.operatorId, counts.records),
        },
        dhis2UploadRate: ratio(counts.submittedRecords, counts.dhis2Records),
        timing: timingStats(imageGaps),
    };
}

// Devices and users belong to one Program, so per-Program distinct counts add up.
export function addCounts(total: PeriodCounts, counts: PeriodCounts) {
    total.activeDevices += counts.activeDevices;
    total.images += counts.images;
    total.uniqueSpecimens += counts.uniqueSpecimens;
    total.records += counts.records;
    total.completeRecords += counts.completeRecords;
    total.dhis2Records += counts.dhis2Records;
    total.submittedRecords += counts.submittedRecords;
    total.imageGaps.push(...counts.imageGaps);
    total.uniqueUsers += counts.uniqueUsers;
    total.logins += counts.logins;
    for (const field of REQUIRED_FIELDS) {
        total.fieldPasses[field] += counts.fieldPasses[field];
    }
}

/** Sessions whose Reporting Month falls in the period. */
export function sessionsInPeriod(
    sessions: Session[],
    period: Period,
    timeZone: string,
): Session[] {
    return sessions.filter(session =>
        inPeriod(monthKeyOf(sessionBucketTime(session), timeZone), period),
    );
}

function specimensBySession(specimens: Specimen[]): Map<number, Specimen[]> {
    const bySession = new Map<number, Specimen[]>();
    for (const specimen of specimens) {
        const list = bySession.get(specimen.sessionId);
        if (list) list.push(specimen);
        else bySession.set(specimen.sessionId, [specimen]);
    }
    return bySession;
}

/**
 * One Session's Records, Images, DHIS2 state and gaps between images. Active
 * Devices are distinct across Sessions, so the caller counts those.
 */
function addSessionCounts(
    counts: PeriodCounts,
    session: Session,
    specimens: Specimen[],
    site: Site | undefined,
    country: string,
) {
    for (const specimen of specimens) {
        const checks = checkRecordFields(specimen, session, site, country);
        counts.uniqueSpecimens += 1;
        counts.images += specimen.images.length;
        counts.records += 1;
        if (REQUIRED_FIELDS.every(field => checks[field]))
            counts.completeRecords += 1;
        for (const field of REQUIRED_FIELDS) {
            if (checks[field]) counts.fieldPasses[field] += 1;
        }
    }
    if (DHIS2_COUNTRIES.includes(country)) {
        counts.dhis2Records += specimens.length;
        if (session.state === 'SUBMITTED')
            counts.submittedRecords += specimens.length;
    }
    counts.imageGaps.push(
        ...timeSessionImages(specimens.flatMap(specimen => specimen.images))
            .gaps,
    );
}

/** Counts for the given Sessions; users and logins are left at 0. */
export function countSessions(
    sessions: Session[],
    { program, snapshot }: ProgramData,
): PeriodCounts {
    const counts = emptyCounts();
    const specimens = specimensBySession(snapshot.specimens);
    const sites = new Map(snapshot.sites.map(site => [site.siteId, site]));
    for (const session of sessions) {
        addSessionCounts(
            counts,
            session,
            specimens.get(session.sessionId) ?? [],
            sites.get(session.siteId),
            program.country,
        );
    }
    counts.activeDevices = new Set(sessions.map(s => s.deviceId)).size;
    return counts;
}

function countProgram(programData: ProgramData, period: Period): PeriodCounts {
    const { snapshot } = programData;
    const counts = countSessions(
        sessionsInPeriod(
            snapshot.sessions,
            period,
            programTimeZone(snapshot.collectionCycles),
        ),
        programData,
    );

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
        return snapshot.sessions.map(session =>
            monthKeyOf(sessionBucketTime(session), timeZone),
        );
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
