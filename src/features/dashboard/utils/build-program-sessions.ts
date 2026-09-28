import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { SessionState } from '@/api/session/validation/session-schema';
import { checkRecordFields } from './check-record-fields';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, programTimeZone, type MonthKey } from './month-key';

export type SessionMissingFields = {
    /** Specimens without a thumbnail species. */
    species: number;
    captureDate: boolean;
    geolocation: boolean;
    operatorId: boolean;
};

export type ProgramSession = {
    sessionId: number;
    state: SessionState | null;
    isCertified: boolean;
    deviceId: number;
    siteId: number;
    collectionDate: number | null;
    submittedAt: number;
    /** Milliseconds from createdAt to certifiedAt; null until certified. */
    timeToConfirmation: number | null;
    specimenCount: number;
    missing: SessionMissingFields;
};

const CERTIFIED_STATES: SessionState[] = ['CERTIFIED', 'SUBMITTED'];

export function buildProgramSessions(
    snapshot: ProgramSnapshot,
    country: string,
    period: { from: MonthKey; to: MonthKey },
): ProgramSession[] {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const sessions = snapshot.sessions.filter(session => {
        const month = monthKeyOf(sessionBucketTime(session), timeZone);
        return (
            isCountedSession(session) &&
            month >= period.from &&
            month <= period.to
        );
    });
    const specimensBySession = Map.groupBy(
        snapshot.specimens,
        specimen => specimen.sessionId,
    );

    const rows = sessions.map(session => {
        const specimens = specimensBySession.get(session.sessionId) ?? [];
        const certifiedAt = session.certifiedBy?.certifiedAt ?? null;
        return {
            sessionId: session.sessionId,
            state: session.state ?? null,
            isCertified:
                !!session.state && CERTIFIED_STATES.includes(session.state),
            deviceId: session.deviceId,
            siteId: session.siteId,
            collectionDate: session.collectionDate,
            submittedAt: session.submittedAt,
            timeToConfirmation:
                certifiedAt !== null && session.createdAt !== null
                    ? certifiedAt - session.createdAt
                    : null,
            specimenCount: specimens.length,
            missing: {
                species: specimens.filter(
                    specimen =>
                        !checkRecordFields(specimen, session, country).species,
                ).length,
                captureDate: session.collectionDate === null,
                geolocation: !isInsideCountry(
                    session.latitude,
                    session.longitude,
                    country,
                ),
                operatorId: session.collectorName.trim() === '',
            },
        };
    });

    // Uncertified first so stuck reviews surface, then oldest first.
    return rows.sort(
        (a, b) =>
            Number(a.isCertified) - Number(b.isCertified) ||
            sessionSortTime(a) - sessionSortTime(b),
    );
}

function sessionSortTime(row: ProgramSession): number {
    return row.collectionDate ?? row.submittedAt;
}
