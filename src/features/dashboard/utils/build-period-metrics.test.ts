import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { CollectionCycle } from '@/api/collection-cycle/validation/collection-cycle-schema';
import type { Session } from '@/api/session/validation/session-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { buildPeriodMetrics, type ProgramData } from './build-period-metrics';

const JAN_10 = Date.UTC(2026, 0, 10);
const FEB_10 = Date.UTC(2026, 1, 10);
const january = { from: '2026-01', to: '2026-01' };
const february = { from: '2026-02', to: '2026-02' };

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
            userLogins: [],
            sites: [1, 2, 3].map(siteId => ({
                siteId,
                name: null,
                district: 'Gulu',
                locationHierarchy: {},
            })),
            fetchedAt: 0,
            ...snapshot,
        },
    };
}

describe('buildPeriodMetrics', () => {
    it("assigns Sessions to months in the Program's timezone", () => {
        // 22:00 UTC on 31 Jan is 01:00 on 1 Feb in Kampala (UTC+3)
        const lateJanuaryUtc = Date.UTC(2026, 0, 31, 22);
        const metrics = buildPeriodMetrics(
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
            february,
        );

        expect(metrics.programs.map(p => p.metrics.uniqueSpecimens)).toEqual([
            1, 0,
        ]);
    });

    it('counts every Image and each Specimen once', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [session(1)],
                    specimens: [specimen(1, 1, 3), specimen(2, 1, 1)],
                }),
            ],
            january,
        );

        expect(metrics.programs[0].metrics).toMatchObject({
            images: 4,
            uniqueSpecimens: 2,
            imagesPerActiveDevice: 4,
        });
    });

    it('counts a device active in several months of the period once', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [
                        session(1),
                        session(2, { collectionDate: FEB_10 }),
                        session(3, { deviceId: 2, collectionDate: FEB_10 }),
                    ],
                }),
            ],
            { from: '2026-01', to: '2026-02' },
        );

        expect(metrics.programs[0].metrics.activeDevices).toBe(2);
    });

    it('leaves ratios blank when their denominator is 0', () => {
        const metrics = buildPeriodMetrics([program(1, {})], january);
        expect(metrics.programs[0].metrics).toMatchObject({
            imagesPerActiveDevice: null,
            metadataCompleteness: null,
            dhis2UploadRate: null,
        });
    });

    it('rates DHIS2 upload as Records in Submitted Sessions over all Records', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { state: 'SUBMITTED' }),
                        session(2, { state: 'CERTIFIED' }),
                        session(3),
                    ],
                    specimens: [
                        specimen(1, 1),
                        specimen(2, 1),
                        specimen(3, 2),
                        specimen(4, 3),
                    ],
                }),
            ],
            january,
        );

        expect(metrics.programs[0].metrics).toMatchObject({
            submittedRecords: 2,
            dhis2Records: 4,
            dhis2UploadRate: 0.5,
        });
    });

    it('leaves DHIS2 upload blank outside Uganda and out of the total', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { state: 'SUBMITTED' }),
                        session(2, { state: 'CERTIFIED' }),
                    ],
                    specimens: [specimen(1, 1), specimen(2, 2)],
                }),
                program(
                    2,
                    {
                        sessions: [session(3, { state: 'CERTIFIED' })],
                        specimens: [specimen(3, 3)],
                    },
                    'Kenya',
                ),
            ],
            january,
        );

        expect(metrics.programs[1].metrics.dhis2UploadRate).toBeNull();
        expect(metrics.total.dhis2UploadRate).toBeCloseTo(1 / 2);
    });

    it('scores metadata completeness per Record and per field', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [session(1), session(2, { collectorName: ' ' })],
                    specimens: [specimen(1, 1), specimen(2, 2)],
                }),
            ],
            january,
        );

        expect(metrics.programs[0].metrics.metadataCompleteness).toBe(0.5);
        expect(metrics.programs[0].metrics.fieldCompleteness).toEqual({
            species: 1,
            captureDate: 1,
            geolocation: 1,
            operatorId: 0.5,
        });
    });

    it('places a Session with no collectionDate by upload time and fails capture date', () => {
        const metrics = buildPeriodMetrics(
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
            february,
        );

        expect(metrics.programs[0].metrics.fieldCompleteness.captureDate).toBe(
            0,
        );
    });

    it('fails location for a Session with no District and no GPS', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { latitude: null }),
                        session(2, { siteId: 99, latitude: null }),
                    ],
                    specimens: [specimen(1, 1), specimen(2, 2)],
                }),
            ],
            january,
        );

        expect(metrics.programs[0].metrics.fieldCompleteness.geolocation).toBe(
            0.5,
        );
    });

    it('pools every gap between images across Sessions and Programs', () => {
        const images = (...seconds: number[]) =>
            seconds.map((s, i) => ({ id: i, capturedAt: JAN_10 + s * 1000 }));
        const timed = (
            id: number,
            sessionId: number,
            ...seconds: number[]
        ) => ({
            ...specimen(id, sessionId),
            images: images(...seconds),
        });
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [session(1), session(2)],
                    // Session 1: 10 s, then 20 s across two specimens
                    specimens: [
                        timed(1, 1, 0, 10),
                        timed(2, 1, 30),
                        timed(3, 2, 0, 40),
                    ],
                }),
                program(2, {
                    sessions: [session(3)],
                    specimens: [timed(4, 3, 0, 50)],
                }),
            ],
            january,
        );

        expect(metrics.programs[0].metrics.timing).toMatchObject({
            count: 3,
            median: 20,
        });
        expect(metrics.total.timing).toMatchObject({
            count: 4,
            median: 30,
            mean: 30,
        });
    });

    it('sums Programs into the total and recomputes ratios from the sums', () => {
        const metrics = buildPeriodMetrics(
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
            january,
        );

        expect(metrics.total).toMatchObject({
            activeDevices: 3,
            images: 6,
            imagesPerActiveDevice: 2,
        });
    });

    it('counts a user once per period and sums their logins', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    userLogins: [
                        {
                            userId: 1,
                            name: null,
                            email: 'u1@example.org',
                            dailyLogins: [
                                { date: '2026-01-05', count: 2 },
                                { date: '2026-02-01', count: 4 },
                                { date: '2026-03-01', count: 9 },
                            ],
                        },
                        {
                            userId: 2,
                            name: null,
                            email: 'u2@example.org',
                            dailyLogins: [{ date: '2026-01-07', count: 1 }],
                        },
                    ],
                }),
            ],
            { from: '2026-01', to: '2026-02' },
        );

        expect(metrics.total).toMatchObject({ uniqueUsers: 2, logins: 7 });
    });

    it('leaves user counts blank for a period before login tracking began', () => {
        const logins = {
            userLogins: [
                {
                    userId: 1,
                    name: null,
                    email: 'u1@example.org',
                    dailyLogins: [{ date: '2026-02-03', count: 1 }],
                },
            ],
        };
        expect(
            buildPeriodMetrics([program(1, logins)], january).total,
        ).toMatchObject({
            uniqueUsers: null,
            logins: null,
        });
        expect(
            buildPeriodMetrics([program(1, logins), program(2, {})], february)
                .programs[1].metrics,
        ).toMatchObject({ uniqueUsers: 0, logins: 0 });
    });

    it('lists the Collection Cycles overlapping the period', () => {
        const metrics = buildPeriodMetrics(
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
            february,
        );

        expect(metrics.programs.map(p => p.cycles)).toEqual([[7], []]);
    });

    it('starts All time at the earliest Session and has no previous period', () => {
        const metrics = buildPeriodMetrics(
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

        expect([metrics.from, metrics.to]).toEqual(['2025-11', '2026-02']);
        expect(metrics.previousTotal).toBeNull();
    });

    it('totals the same-length period just before for comparison', () => {
        const metrics = buildPeriodMetrics(
            [
                program(1, {
                    sessions: [
                        session(1, { collectionDate: Date.UTC(2025, 11, 3) }),
                        session(2, { deviceId: 2 }),
                        session(3, {
                            deviceId: 3,
                            collectionDate: Date.UTC(2026, 2, 3),
                        }),
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-03' },
        );

        expect(metrics.total.activeDevices).toBe(1);
        expect(metrics.previousTotal?.activeDevices).toBe(2);
    });
});
