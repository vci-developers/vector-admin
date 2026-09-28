import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, programTimeZone, type MonthKey } from './month-key';

export type SpecimenPoint = {
    sessionId: number;
    programId: number;
    deviceId: number;
    month: MonthKey;
    latitude: number;
    longitude: number;
    specimenCount: number;
    collectedAt: number;
};

export type UnplacedCounts = { sessions: number; specimens: number };

export type SpecimenPoints = {
    placed: SpecimenPoint[];
    unplaced: Record<MonthKey, UnplacedCounts>;
};

// One point per Session in the given months, at its GPS (recorded at upload).
// Zero-catch Sessions stay on the map: an empty trap is still data.
export function buildSpecimenPoints(
    snapshot: ProgramSnapshot,
    country: string,
    months: MonthKey[],
): SpecimenPoints {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const inRange = new Set(months);
    const specimenCounts = new Map<number, number>();
    for (const specimen of snapshot.specimens) {
        specimenCounts.set(
            specimen.sessionId,
            (specimenCounts.get(specimen.sessionId) ?? 0) + 1,
        );
    }

    const points: SpecimenPoints = { placed: [], unplaced: {} };
    for (const session of snapshot.sessions) {
        const collectedAt = sessionBucketTime(session);
        const month = monthKeyOf(collectedAt, timeZone);
        if (!isCountedSession(session) || !inRange.has(month)) continue;

        const specimenCount = specimenCounts.get(session.sessionId) ?? 0;
        if (
            session.latitude === null ||
            session.longitude === null ||
            !isInsideCountry(session.latitude, session.longitude, country)
        ) {
            const unplaced = (points.unplaced[month] ??= {
                sessions: 0,
                specimens: 0,
            });
            unplaced.sessions += 1;
            unplaced.specimens += specimenCount;
            continue;
        }
        points.placed.push({
            sessionId: session.sessionId,
            programId: snapshot.programId,
            deviceId: session.deviceId,
            month,
            latitude: session.latitude,
            longitude: session.longitude,
            specimenCount,
            collectedAt,
        });
    }
    return points;
}
