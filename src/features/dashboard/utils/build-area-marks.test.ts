import { describe, expect, it } from 'vitest';
import { areaKey, buildAreaMarks } from './build-area-marks';

const place = (area: string | null) =>
    area
        ? [
              { level: 'District', name: area },
              { level: 'Village', name: `${area} village` },
          ]
        : [];

const session = (
    sessionId: number,
    area: string | null,
    specimenCount: number,
    latitude: number,
    longitude: number,
    programId = 1,
) => ({
    sessionId,
    programId,
    latitude,
    longitude,
    specimenCount,
    location: place(area),
});

const device = (
    deviceId: number,
    area: string,
    latitude = 0,
    longitude = 0,
) => ({
    deviceId,
    programId: 1,
    position: { latitude, longitude },
    location: place(area),
});

describe('buildAreaMarks', () => {
    it('sums specimens per Area at the mean of its Sessions', () => {
        const [gulu, arua] = buildAreaMarks({
            sessions: [
                session(1, 'Gulu', 3, 2, 32),
                session(2, 'Arua', 5, 3, 31),
                session(3, 'Gulu', 7, 4, 34),
            ],
            devices: [],
            anchors: new Map(),
        });

        expect(gulu).toMatchObject({
            name: 'Gulu',
            sessionIds: [1, 3],
            specimenCount: 10,
            latitude: 3,
            longitude: 33,
        });
        expect(arua).toMatchObject({ name: 'Arua', sessionIds: [2] });
    });

    it("sits at its Coverage Unit's anchor, matched without case", () => {
        const [gulu] = buildAreaMarks({
            sessions: [session(1, 'Gulu', 3, 2, 32)],
            devices: [],
            anchors: new Map([[areaKey(1, 'GULU'), [2.8, 32.3]]]),
        });

        expect([gulu.latitude, gulu.longitude]).toEqual([2.8, 32.3]);
    });

    it("counts each Area's devices, and places a device-only Area at them", () => {
        const [gulu, lira] = buildAreaMarks({
            sessions: [session(1, 'Gulu', 3, 2, 32)],
            devices: [device(10, 'Gulu'), device(11, 'Lira', 2.2, 32.9)],
            anchors: new Map(),
        });

        expect(gulu.deviceIds).toEqual([10]);
        expect(lira).toMatchObject({
            sessionIds: [],
            deviceIds: [11],
            latitude: 2.2,
            longitude: 32.9,
        });
    });

    it("shows an Area's given device count over its device ids", () => {
        const [gulu, lira] = buildAreaMarks({
            sessions: [],
            devices: [device(10, 'Gulu'), device(11, 'Lira', 2.2, 32.9)],
            anchors: new Map(),
            deviceCounts: new Map([[areaKey(1, 'Gulu'), 3]]),
        });

        expect([gulu.deviceCount, lira.deviceCount]).toEqual([3, 1]);
    });

    it('keeps Areas of the same name in different Programs apart', () => {
        const marks = buildAreaMarks({
            sessions: [
                session(1, 'Central', 1, 0, 0, 1),
                session(2, 'Central', 1, 0, 0, 2),
            ],
            devices: [],
            anchors: new Map(),
        });

        expect(marks.map(m => m.programId)).toEqual([1, 2]);
    });

    it('groups Sessions with no place names together', () => {
        const [none] = buildAreaMarks({
            sessions: [session(1, null, 2, 0, 0), session(2, null, 4, 0, 0)],
            devices: [],
            anchors: new Map(),
        });

        expect(none).toMatchObject({ name: null, specimenCount: 6 });
    });
});
