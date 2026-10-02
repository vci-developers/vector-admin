import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, programTimeZone, type MonthKey } from './month-key';

/** Specimens of one Session sharing species, sex and abdomen status. */
export type SpecimenGroup = {
    species: string | null;
    sex: string | null;
    abdomenStatus: string | null;
    count: number;
};

export type SpecimenPoint = {
    sessionId: number;
    programId: number;
    deviceId: number;
    siteId: number;
    latitude: number;
    longitude: number;
    specimenCount: number;
    /** What the map's specimen filters match against. */
    specimenGroups: SpecimenGroup[];
    collectedAt: number;
};

/** A Session without an in-country fix; the map may place it at its Site. */
export type UnplacedSession = Omit<SpecimenPoint, 'latitude' | 'longitude'>;

export type SpecimenPoints = {
    placed: SpecimenPoint[];
    unplaced: UnplacedSession[];
};

// One point per Session in the period, at its GPS (recorded at upload).
// Zero-catch Sessions stay on the map: an empty trap is still data.
export function buildSpecimenPoints(
    snapshot: ProgramSnapshot,
    country: string,
    period: { from: MonthKey; to: MonthKey },
): SpecimenPoints {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const groupsBySession = groupSpecimens(snapshot.specimens);

    const points: SpecimenPoints = { placed: [], unplaced: [] };
    for (const session of snapshot.sessions) {
        const collectedAt = sessionBucketTime(session);
        const month = monthKeyOf(collectedAt, timeZone);
        if (month < period.from || month > period.to) {
            continue;
        }

        const specimenGroups = groupsBySession.get(session.sessionId) ?? [];
        const specimenCount = specimenGroups.reduce(
            (sum, group) => sum + group.count,
            0,
        );
        if (
            session.latitude === null ||
            session.longitude === null ||
            !isInsideCountry(session.latitude, session.longitude, country)
        ) {
            points.unplaced.push({
                sessionId: session.sessionId,
                programId: snapshot.programId,
                deviceId: session.deviceId,
                siteId: session.siteId,
                specimenCount,
                specimenGroups,
                collectedAt,
            });
            continue;
        }
        points.placed.push({
            sessionId: session.sessionId,
            programId: snapshot.programId,
            deviceId: session.deviceId,
            siteId: session.siteId,
            latitude: session.latitude,
            longitude: session.longitude,
            specimenCount,
            specimenGroups,
            collectedAt,
        });
    }
    return points;
}

function groupSpecimens(specimens: Specimen[]): Map<number, SpecimenGroup[]> {
    const bySession = new Map<number, Map<string, SpecimenGroup>>();
    for (const specimen of specimens) {
        const species = specimen.thumbnailImage?.species ?? null;
        const sex = specimen.thumbnailImage?.sex ?? null;
        const abdomenStatus = specimen.thumbnailImage?.abdomenStatus ?? null;
        const key = JSON.stringify([species, sex, abdomenStatus]);
        let groups = bySession.get(specimen.sessionId);
        if (!groups) {
            groups = new Map();
            bySession.set(specimen.sessionId, groups);
        }
        const group = groups.get(key);
        if (group) group.count += 1;
        else groups.set(key, { species, sex, abdomenStatus, count: 1 });
    }
    return new Map(
        [...bySession].map(([sessionId, groups]) => [
            sessionId,
            [...groups.values()],
        ]),
    );
}
