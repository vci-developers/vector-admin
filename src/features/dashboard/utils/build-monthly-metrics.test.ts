import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { CollectionCycle } from '@/api/collection-cycle/validation/collection-cycle-schema';
import type { Session } from '@/api/session/validation/session-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { buildMonthlyMetrics, type ProgramData } from './build-monthly-metrics';

const JAN_10 = Date.UTC(2026, 0, 10);
const FEB_10 = Date.UTC(2026, 1, 10);
const range = { from: '2026-01', to: '2026-02' };

function session(sessionId: number, overrides: Partial<Session> = {}): Session {
    return {
        sessionId,
        deviceId: 1,
        siteId: 1,
        type: 'SURVEILLANCE',
        state: 'NEEDS_REVIEW',
        collectorName: 'Jane Doe',
        collectionDate: JAN_10,
        createdAt: JAN_10,
        submittedAt: JAN_10,
        latitude: 0.35,
        longitude: 32.58,
        ...overrides,
    };
}

function specimen(id: number, sessionId: number, imageCount = 1): Specimen {
    return {
        id,
        sessionId,
        images: Array.from({ length: imageCount }, (_, i) => ({
            id: id * 10 + i,
        })),
        thumbnailImage: { species: 'Anopheles gambiae' },
    };
}

const kampalaCycle = (
    overrides: Partial<CollectionCycle> = {},
): CollectionCycle => ({
    id: 1,
    cycleNumber: 5,
    startDate: Date.UTC(2025, 11, 1),
    endDate: Date.UTC(2025, 11, 2),
    timezone: 'Africa/Kampala',
    ...overrides,
});

function program(
    programId: number,
    snapshot: Partial<ProgramSnapshot>,
    country = 'Uganda',
): ProgramData {
    return {
        program: { programId, name: `Program ${programId}`, country },
        snapshot: {
            programId,
            sessions: [],
            specimens: [],
            devices: [],
            collectionCycles: [],
            fetchedAt: 0,
            ...snapshot,
        },
    };
}

describe('buildMonthlyMetrics', () => {
    it("buckets by collectionDate in the Program's timezone", () => {
        // 22:00 UTC on 31 Jan is 01:00 on 1 Feb in Kampala (UTC+3)
        const lateJanuaryUtc = Date.UTC(2026, 0, 31, 22);
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [session(1, { collectionDate: lateJanuaryUtc })],
                    specimens: [specimen(1, 1)],
                    collectionCycles: [kampalaCycle()],
                }),
                program(2, {
                    sessions: [session(2, { collectionDate: lateJanuaryUtc })],
                    specimens: [specimen(2, 2)],
                }),
            ],
            range,
        );

        expect(metrics.programs[0].months['2026-02'].uniqueSpecimens).toBe(1);
        expect(metrics.programs[1].months['2026-01'].uniqueSpecimens).toBe(1);
    });

    it('counts every image as a Scan and each Specimen once', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [session(1)],
                    specimens: [specimen(1, 1, 3), specimen(2, 1, 1)],
                }),
            ],
            range,
        );
        const january = metrics.programs[0].months['2026-01'];

        expect(january.scans).toBe(4);
        expect(january.uniqueSpecimens).toBe(2);
        expect(january.scansPerActiveDevice).toBe(4);
    });

    it('leaves Scans per Active Device blank with no active devices', () => {
        const metrics = buildMonthlyMetrics([program(1, {})], range);
        expect(
            metrics.programs[0].months['2026-01'].scansPerActiveDevice,
        ).toBeNull();
    });

    it('rates DHIS2 upload as SUBMITTED over CERTIFIED plus SUBMITTED', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { state: 'SUBMITTED' }),
                        session(2, { state: 'CERTIFIED' }),
                        session(3, { state: 'SUBMITTED' }),
                        session(4, { state: 'NEEDS_REVIEW' }),
                        session(5, {
                            state: 'IN_REVIEW',
                            collectionDate: FEB_10,
                        }),
                    ],
                }),
            ],
            range,
        );

        expect(
            metrics.programs[0].months['2026-01'].dhis2UploadRate,
        ).toBeCloseTo(2 / 3);
        expect(
            metrics.programs[0].months['2026-02'].dhis2UploadRate,
        ).toBeNull();
    });

    it('scores metadata completeness per Record and per field', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [session(1), session(2, { collectorName: ' ' })],
                    specimens: [specimen(1, 1), specimen(2, 2)],
                }),
            ],
            range,
        );
        const january = metrics.programs[0].months['2026-01'];

        expect(january.metadataCompleteness).toBe(0.5);
        expect(january.fieldCompleteness).toEqual({
            species: 1,
            captureDate: 1,
            geolocation: 1,
            operatorId: 0.5,
        });
    });

    it('buckets a Session with no collectionDate by upload time and fails capture date', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, {
                            collectionDate: null,
                            submittedAt: FEB_10,
                        }),
                    ],
                    specimens: [specimen(1, 1)],
                }),
            ],
            range,
        );

        expect(
            metrics.programs[0].months['2026-02'].fieldCompleteness.captureDate,
        ).toBe(0);
    });

    it('ignores practice and calibration Sessions', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { type: 'PRACTICE' }),
                        session(2, { type: 'CALIBRATION', deviceId: 2 }),
                    ],
                    specimens: [specimen(1, 1), specimen(2, 2)],
                }),
            ],
            range,
        );
        const january = metrics.programs[0].months['2026-01'];

        expect(january.activeDevices).toBe(0);
        expect(january.uniqueSpecimens).toBe(0);
    });

    it('sums counts into Total rows and recomputes ratios from the sums', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [session(1), session(2, { deviceId: 2 })],
                    specimens: [specimen(1, 1, 3)],
                }),
                program(2, {
                    sessions: [session(3)],
                    specimens: [specimen(2, 3, 3)],
                }),
            ],
            range,
        );
        const january = metrics.totals['2026-01'];

        expect(january.activeDevices).toBe(3);
        expect(january.scans).toBe(6);
        expect(january.scansPerActiveDevice).toBe(2);
    });

    it('labels every month a Collection Cycle overlaps', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    collectionCycles: [
                        kampalaCycle({
                            cycleNumber: 7,
                            // 15 Jan to 15 Feb Kampala time
                            startDate: Date.UTC(2026, 0, 14, 21),
                            endDate: Date.UTC(2026, 1, 14, 21),
                        }),
                    ],
                }),
                program(2, {}),
            ],
            { from: '2026-01', to: '2026-03' },
        );

        expect(metrics.programs[0].cycleLabels).toEqual({
            '2026-01': [7],
            '2026-02': [7],
            '2026-03': [],
        });
        expect(metrics.programs[1].cycleLabels).toEqual({
            '2026-01': [],
            '2026-02': [],
            '2026-03': [],
        });
    });

    it('starts All time at the earliest Session month', () => {
        const metrics = buildMonthlyMetrics(
            [
                program(1, {
                    sessions: [session(1, { collectionDate: FEB_10 })],
                }),
                program(2, {
                    sessions: [
                        session(2, { collectionDate: Date.UTC(2025, 10, 5) }),
                    ],
                }),
            ],
            { to: '2026-02' },
        );

        expect(metrics.months).toEqual([
            '2025-11',
            '2025-12',
            '2026-01',
            '2026-02',
        ]);
    });
});
