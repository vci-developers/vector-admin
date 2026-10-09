import type { LocationLevel } from './site-location-path';

type Located = {
    programId: number;
    location: LocationLevel[];
};
type AreaSession = Located & {
    sessionId: number;
    latitude: number;
    longitude: number;
    specimenCount: number;
};
type AreaDevice = Located & {
    deviceId: number;
    position: { latitude: number; longitude: number };
};

/** One mark per Area: a Program's top-level place (District or Region). */
export type AreaMark = {
    key: string;
    programId: number;
    /** null for Sessions and devices whose Site has no place names. */
    name: string | null;
    sessionIds: number[];
    specimenCount: number;
    deviceIds: number[];
    /** Active devices to show: the given count, else its devices. */
    deviceCount: number;
    /** Planned devices where the Program plans per Area; else null. */
    plannedDevices: number | null;
    latitude: number;
    longitude: number;
};

/** "programId:area name", case ignored, so an Area matches its Coverage Unit. */
export const areaKey = (programId: number, name: string | null) =>
    `${programId}:${name?.toLowerCase() ?? ''}`;

/**
 * Groups the map's Sessions and devices by Area, so the map shows one mark
 * per District (legacy Sites) or top hierarchy level. A mark sits at its
 * anchor (where its Coverage Unit's name goes) when it has one, else at the
 * mean of its Sessions' positions, else of its devices'.
 */
export function buildAreaMarks({
    sessions,
    devices,
    anchors,
    deviceCounts,
    devicePlans,
}: {
    sessions: AreaSession[];
    devices: AreaDevice[];
    anchors: Map<string, [number, number]>;
    /** Active devices per Area key where they aren't the device ids. */
    deviceCounts?: Map<string, number>;
    /** Planned devices per Area key, where known. */
    devicePlans?: Map<string, number>;
}): AreaMark[] {
    const marks = new Map<
        string,
        AreaMark & {
            sessionAt: [number, number][];
            deviceAt: [number, number][];
        }
    >();
    const markOf = ({ programId, location }: Located) => {
        const name = location[0]?.name ?? null;
        const key = areaKey(programId, name);
        let mark = marks.get(key);
        if (!mark) {
            mark = {
                key,
                programId,
                name,
                sessionIds: [],
                specimenCount: 0,
                deviceIds: [],
                deviceCount: 0,
                plannedDevices: null,
                latitude: 0,
                longitude: 0,
                sessionAt: [],
                deviceAt: [],
            };
            marks.set(key, mark);
        }
        return mark;
    };
    for (const session of sessions) {
        const mark = markOf(session);
        mark.sessionIds.push(session.sessionId);
        mark.specimenCount += session.specimenCount;
        mark.sessionAt.push([session.latitude, session.longitude]);
    }
    for (const device of devices) {
        const mark = markOf(device);
        mark.deviceIds.push(device.deviceId);
        mark.deviceAt.push([
            device.position.latitude,
            device.position.longitude,
        ]);
    }
    return [...marks.values()].map(({ sessionAt, deviceAt, ...mark }) => {
        const [latitude, longitude] =
            anchors.get(mark.key) ??
            mean(sessionAt.length > 0 ? sessionAt : deviceAt);
        return {
            ...mark,
            deviceCount: deviceCounts?.get(mark.key) ?? mark.deviceIds.length,
            plannedDevices: devicePlans?.get(mark.key) ?? null,
            latitude,
            longitude,
        };
    });
}

function mean(points: [number, number][]): [number, number] {
    const [lat, lon] = points.reduce(
        ([sumLat, sumLon], [pLat, pLon]) => [sumLat + pLat, sumLon + pLon],
        [0, 0],
    );
    return [lat / points.length, lon / points.length];
}
