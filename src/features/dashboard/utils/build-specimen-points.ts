import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, programTimeZone, type MonthKey } from './month-key';

export type SpecimenPoint = {
    sessionId: number;
    programId: number;
    deviceId: number;
    latitude: number;
    longitude: number;
    specimenCount: number;
    collectedAt: number;
};

export type SpecimenPoints = {
    placed: SpecimenPoint[];
    unplacedSessions: number;
    unplacedSpecimens: number;
};

// One point per Session in the month, at its GPS (recorded at upload).
// Zero-catch Sessions stay on the map: an empty trap is still data.
export function buildSpecimenPoints(
    snapshot: ProgramSnapshot,
    country: string,
    month: MonthKey,
): SpecimenPoints {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const specimenCounts = new Map<number, number>();
    for (const specimen of snapshot.specimens) {
        specimenCounts.set(
            specimen.sessionId,
            (specimenCounts.get(specimen.sessionId) ?? 0) + 1,
        );
    }

    const points: SpecimenPoints = {
        placed: [],
        unplacedSessions: 0,
        unplacedSpecimens: 0,
    };
    for (const session of snapshot.sessions) {
        const collectedAt = sessionBucketTime(session);
        if (
            !isCountedSession(session) ||
            monthKeyOf(collectedAt, timeZone) !== month
        ) {
            continue;
        }
        const specimenCount = specimenCounts.get(session.sessionId) ?? 0;
        if (
            session.latitude === null ||
            session.longitude === null ||
            !isInsideCountry(session.latitude, session.longitude, country)
        ) {
            points.unplacedSessions += 1;
            points.unplacedSpecimens += specimenCount;
            continue;
        }
        points.placed.push({
            sessionId: session.sessionId,
            programId: snapshot.programId,
            deviceId: session.deviceId,
            latitude: session.latitude,
            longitude: session.longitude,
            specimenCount,
            collectedAt,
        });
    }
    return points;
}
