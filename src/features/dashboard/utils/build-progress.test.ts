import type { ProgressSnapshot } from '@/api/admin/load-progress-snapshot';
import type { ProgressSession } from '@/api/progress/validation/progress-snapshot-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import {
    buildProgress,
    progressDistrictName,
    type ProgressProgramData,
} from './build-progress';

const FEB = Date.UTC(2026, 1, 5);
const MAR = Date.UTC(2026, 2, 5);

const session = (
    sessionId: number,
    fields: Partial<ProgressSession> = {},
): ProgressSession => ({
    sessionId,
    siteId: 1,
    type: 'SURVEILLANCE',
    collectionDate: FEB,
    submittedAt: MAR,
    latitude: 2.77,
    longitude: 32.3,
    ...fields,
});

const house = (siteId: number, villageName = 'Aleu'): Site => ({
    siteId,
    name: null,
    district: 'Gulu',
    subCounty: 'Bobi',
    villageName,
    houseNumber: `House ${siteId}`,
    locationHierarchy: {},
});

const program = (
    fields: Partial<ProgressSnapshot> = {},
    programId = 7,
    country = 'Uganda',
): ProgressProgramData => ({
    program: { programId, name: `Program ${programId}`, country },
    snapshot: {
        programId,
        sessions: [],
        specimens: [],
        sites: [house(1), house(2), house(3, 'Awach')],
        collectionCycles: [
            {
                id: 1,
                cycleNumber: 1,
                startDate: 0,
                endDate: MAR,
                timezone: 'Africa/Kampala',
            },
        ],
        fetchedAt: 100,
        ...fields,
    },
});

describe('buildProgress', () => {
    it('counts 200 scans when 100 specimens each contain two images', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [session(1)],
                    specimens: Array.from({ length: 100 }, (_, index) => ({
                        id: index + 1,
                        sessionId: 1,
                        images: [{ id: index * 2 + 1 }, { id: index * 2 + 2 }],
                    })),
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(200);
        expect(data.scansByProgram).toEqual([{ programId: 7, scans: 200 }]);
        expect(data.monthly).toEqual([{ month: '2026-02', uniqueScans: 200 }]);
        expect(data.districts[0].uniqueScans).toBe(200);
        expect(data.districts[0].scansByProgram).toEqual(data.scansByProgram);
        expect(data.reportingLocations).toBe(1);
    });

    it('counts each image once and retains locations with no images', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [session(1), session(2, { siteId: 3 })],
                    specimens: [
                        {
                            id: 1,
                            sessionId: 1,
                            images: [{ id: 10 }, { id: 11 }, { id: 10 }],
                        },
                        {
                            id: 2,
                            sessionId: 1,
                            images: [{ id: 11 }, { id: 12 }],
                        },
                        { id: 3, sessionId: 2, images: [] },
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(3);
        expect(data.reportingLocations).toBe(2);
        expect(data.districts[0].uniqueScans).toBe(3);
    });

    it('does not let excluded or out-of-period records consume eligible image IDs', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [
                        session(1, { collectionDate: MAR }),
                        session(2, { type: 'PRACTICE' }),
                        session(3),
                    ],
                    specimens: [
                        { id: 1, sessionId: 1, images: [{ id: 10 }] },
                        { id: 2, sessionId: 2, images: [{ id: 11 }] },
                        {
                            id: 3,
                            sessionId: 3,
                            images: [{ id: 10 }, { id: 11 }],
                        },
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(2);
        expect(data.scansByProgram).toEqual([{ programId: 7, scans: 2 }]);
        expect(data.monthly[0].uniqueScans).toBe(2);
    });

    it('attributes shared districts to their contributing programs while reconciling deduplicated images and zero catches', () => {
        const data = buildProgress(
            [
                program({}, 9),
                program(
                    {
                        sessions: [
                            session(1),
                            session(2, { siteId: 2 }),
                            session(3, { collectionDate: MAR }),
                            session(4, { type: 'PRACTICE' }),
                            session(5, { type: 'CALIBRATION' }),
                        ],
                        sites: [house(1), { ...house(2), district: 'Lira' }],
                        specimens: [
                            { id: 1, sessionId: 1, images: [{ id: 10 }] },
                            { id: 2, sessionId: 2, images: [] },
                            { id: 3, sessionId: 3, images: [{ id: 30 }] },
                            { id: 4, sessionId: 4, images: [{ id: 40 }] },
                            { id: 5, sessionId: 5, images: [{ id: 50 }] },
                        ],
                    },
                    8,
                ),
                program(
                    {
                        sessions: [
                            session(1),
                            session(2, { siteId: 2 }),
                            session(3, { siteId: 11 }),
                        ],
                        sites: [
                            house(1),
                            { ...house(2), district: 'Lira' },
                            { ...house(11), district: 'Other' },
                        ],
                        specimens: [
                            {
                                id: 1,
                                sessionId: 1,
                                images: [{ id: 10 }, { id: 11 }, { id: 10 }],
                            },
                            { id: 2, sessionId: 1, images: [{ id: 11 }] },
                            {
                                id: 3,
                                sessionId: 2,
                                images: [{ id: 20 }, { id: 21 }, { id: 22 }],
                            },
                            { id: 4, sessionId: 3, images: [{ id: 60 }] },
                        ],
                    },
                    7,
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );

        expect(data.scansByProgram).toEqual([
            { programId: 7, scans: 5 },
            { programId: 8, scans: 1 },
            { programId: 9, scans: 0 },
        ]);
        expect(
            data.districts.map(({ name, scansByProgram }) => ({
                name,
                scansByProgram,
            })),
        ).toEqual([
            {
                name: 'Gulu',
                scansByProgram: [
                    { programId: 7, scans: 2 },
                    { programId: 8, scans: 1 },
                ],
            },
            {
                name: 'Lira',
                scansByProgram: [
                    { programId: 7, scans: 3 },
                    { programId: 8, scans: 0 },
                ],
            },
        ]);
        expect(data.uniqueScans).toBe(6);
        expect(
            data.scansByProgram.reduce((sum, row) => sum + row.scans!, 0),
        ).toBe(data.uniqueScans);
        expect(
            data.monthly.reduce((sum, row) => sum + row.uniqueScans, 0),
        ).toBe(data.uniqueScans);
        for (const district of data.districts) {
            expect(
                district.scansByProgram.reduce(
                    (sum, row) => sum + row.scans!,
                    0,
                ),
            ).toBe(district.uniqueScans);
            expect(district.scansByProgram.map(row => row.programId)).toEqual(
                district.programIds,
            );
        }
    });

    it('reconciles deduplicated scans, districts and local reporting months while including zero catches and missing GPS', () => {
        const first = session(1, {
            // February in Kampala, despite January in UTC.
            collectionDate: Date.UTC(2026, 0, 31, 22),
        });
        const data = buildProgress(
            [
                program({
                    sessions: [
                        first,
                        first,
                        session(2, { siteId: 2 }), // Separate household, no catches.
                        session(3, {
                            siteId: 3,
                            latitude: null,
                            longitude: null,
                        }),
                        session(4, {
                            siteId: 99,
                            collectionDate: null,
                            submittedAt: MAR + 1,
                        }),
                        session(5, { type: 'PRACTICE' }),
                        session(6, { siteId: 11 }),
                    ],
                    sites: [
                        house(1),
                        house(2),
                        house(3, 'Awach'),
                        {
                            ...house(11),
                            district: 'Other',
                        },
                    ],
                    specimens: [
                        { id: 10, sessionId: 1, images: [{ id: 100 }] },
                        { id: 10, sessionId: 1, images: [{ id: 100 }] },
                        { id: 11, sessionId: 1, images: [{ id: 110 }] },
                        { id: 12, sessionId: 3, images: [{ id: 120 }] },
                        { id: 13, sessionId: 4, images: [{ id: 130 }] },
                        { id: 14, sessionId: 5, images: [{ id: 140 }] },
                        { id: 15, sessionId: 6, images: [{ id: 150 }] },
                        { id: 16, sessionId: 100, images: [{ id: 160 }] },
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-03' },
        );

        expect(data.reportingLocations).toBeNull();
        expect(data.coverageByProgram).toEqual([
            { programId: 7, unit: 'household', count: null },
        ]);
        expect(data.uniqueScans).toBe(4);
        expect(data.monthly).toEqual([
            { month: '2026-02', uniqueScans: 3 },
            { month: '2026-03', uniqueScans: 1 },
        ]);
        expect(
            data.districts.map(row => ({
                name: row.name,
                reportingLocations: row.reportingLocations,
                uniqueScans: row.uniqueScans,
            })),
        ).toEqual([
            {
                name: 'District not recorded',
                reportingLocations: null,
                uniqueScans: 1,
            },
            { name: 'Gulu', reportingLocations: 3, uniqueScans: 3 },
        ]);
        expect(data.districts[0].position).toBeNull();
        expect(
            data.districts
                .flatMap(row => row.monthly)
                .reduce((sum, row) => sum + row.uniqueScans, 0),
        ).toBe(data.uniqueScans);
        expect(data.latestReceivedAt).toBe(MAR + 1);
    });

    it('counts an active zero-catch location and retains quiet months', () => {
        const data = buildProgress([program({ sessions: [session(1)] })], {
            from: '2026-01',
            to: '2026-03',
        });
        expect(data.reportingLocations).toBe(1);
        expect(data.uniqueScans).toBe(0);
        expect(data.scansByProgram).toEqual([{ programId: 7, scans: 0 }]);
        expect(data.monthly.map(row => row.uniqueScans)).toEqual([0, 0, 0]);
        expect(data.districts[0].reportingLocations).toBe(1);
        expect(data.districts[0].scansByProgram).toEqual(data.scansByProgram);
    });

    it('uses an explicit District below a Region and never labels a Region as a district', () => {
        const hierarchical: Site = {
            siteId: 1,
            name: 'Village A',
            locationHierarchy: {
                Region: 'Northern',
                District: 'Lira',
                Village: 'Village A',
            },
        };
        expect(progressDistrictName(hierarchical)).toBe('Lira');
        const data = buildProgress(
            [
                program({
                    sessions: [session(1), session(2, { siteId: 2 })],
                    sites: [
                        hierarchical,
                        {
                            ...hierarchical,
                            siteId: 2,
                            locationHierarchy: { Region: 'Northern' },
                        },
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.districts.map(row => row.name)).toEqual([
            'District not recorded',
            'Lira',
        ]);
        expect(data.districts[0].position).toBeNull();
    });

    it('merges canonical district names and prefers committed anchors to upload GPS', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [session(1), session(2, { siteId: 2 })],
                    sites: [
                        house(1),
                        { ...house(2), district: ' gULU District ' },
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
            new Map([['uganda:gulu', { latitude: 2.8, longitude: 32.4 }]]),
        );
        expect(data.districts).toHaveLength(1);
        expect(data.districts[0].position).toEqual({
            latitude: 2.8,
            longitude: 32.4,
        });
        expect(data.reportingLocations).toBe(2);
    });

    it('counts active households rather than registered houses or villages in reviewed Uganda', () => {
        const data = buildProgress(
            [
                program(
                    {
                        sessions: [
                            session(1),
                            session(2),
                            session(3, { siteId: 2 }),
                        ],
                    },
                    1,
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.coverageByProgram).toEqual([
            { programId: 1, unit: 'household', count: 2 },
        ]);
        expect(data.reportingLocations).toBe(2);
        expect(data.districts[0].coverageByProgram).toEqual(
            data.coverageByProgram,
        );
        expect(data.uniqueScans).toBe(0);
    });

    it('counts Colombia municipal locations once even across duplicate registrations or descendants', () => {
        const data = buildProgress(
            [
                program(
                    {
                        sessions: [
                            session(1),
                            session(2, { siteId: 2 }),
                            session(3, { siteId: 3 }),
                        ],
                        sites: [
                            { ...house(1), houseNumber: 'N/A' },
                            { ...house(2), houseNumber: 'N/A' },
                            { ...house(3, 'Town B'), houseNumber: 'N/A' },
                        ],
                    },
                    2,
                    'Colombia',
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.coverageByProgram).toEqual([
            { programId: 2, unit: 'municipality', count: 2 },
        ]);
        expect(data.reportingLocations).toBe(2);
    });

    it('keeps Colombian municipality counts under their recorded department reporting area', () => {
        const site: Site = {
            siteId: 1,
            name: 'Turbo',
            locationHierarchy: {
                Departamento: 'Antioquia',
                Municipio: 'Turbo',
            },
        };
        const data = buildProgress(
            [program({ sessions: [session(1)], sites: [site] }, 2, 'Colombia')],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.coverageByProgram).toEqual([
            { programId: 2, unit: 'municipality', count: 1 },
        ]);
        expect(data.districts[0]).toMatchObject({
            key: 'colombia:antioquia',
            name: 'Antioquia',
            reportingLocations: 1,
        });
    });

    it('names Cameroon Health District leaves without promoting Region parents', () => {
        const healthDistrict: Site = {
            siteId: 1,
            name: 'Lagdo',
            locationHierarchy: { Region: 'North', 'Health District': 'Lagdo' },
        };
        const ward = (siteId: number, name: string): Site => ({
            ...healthDistrict,
            siteId,
            locationHierarchy: {
                ...healthDistrict.locationHierarchy,
                District: name,
            },
        });
        const data = buildProgress(
            [
                program(
                    {
                        sessions: [
                            session(1),
                            session(2, { siteId: 2 }),
                            session(3, { siteId: 3 }),
                        ],
                        sites: [
                            healthDistrict,
                            ward(2, 'Ward A'),
                            ward(3, 'Ward B'),
                        ],
                    },
                    6,
                    'Cameroon',
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(progressDistrictName(healthDistrict)).toBe('Lagdo');
        expect(progressDistrictName(ward(2, 'Ward A'), 'health-district')).toBe(
            'Lagdo',
        );
        expect(data.coverageByProgram).toEqual([
            { programId: 6, unit: 'health-district', count: 1 },
        ]);
        expect(data.districts[0]).toMatchObject({
            key: 'cameroon:lagdo',
            name: 'Lagdo',
            reportingLocations: 1,
        });
        expect(data.districts).toHaveLength(1);
        expect(
            progressDistrictName({
                ...healthDistrict,
                locationHierarchy: { Region: 'North' },
            }),
        ).toBeNull();
    });

    it('keeps unlike program units separate rather than adding households to municipalities', () => {
        const data = buildProgress(
            [
                program({ sessions: [session(1)] }, 1),
                program(
                    {
                        sessions: [session(1)],
                        sites: [{ ...house(1), houseNumber: 'N/A' }],
                    },
                    2,
                    'Colombia',
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.reportingLocations).toBeNull();
        expect(data.coverageByProgram).toEqual([
            { programId: 1, unit: 'household', count: 1 },
            { programId: 2, unit: 'municipality', count: 1 },
        ]);
        expect(
            data.districts.every(district => district.reportingLocations === 1),
        ).toBe(true);
    });

    it('preserves per-program units when unlike reporting units share a mapped district', () => {
        const data = buildProgress(
            [
                program({ sessions: [session(1)] }, 7),
                program(
                    {
                        sessions: [session(1)],
                        sites: [{ ...house(1), houseNumber: 'N/A' }],
                    },
                    8,
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.districts).toHaveLength(1);
        expect(data.districts[0].reportingLocations).toBeNull();
        expect(data.districts[0].coverageByProgram).toEqual([
            { programId: 7, unit: 'household', count: 1 },
            { programId: 8, unit: 'community', count: 1 },
        ]);
    });

    it('marks Ghana household coverage incomplete for an active Sentinel Site parent while retaining all scans', () => {
        const parent: Site = {
            siteId: 1,
            name: 'School',
            locationHierarchy: {
                Region: 'Western',
                District: 'Tarkwa',
                'Town/Village': 'Tamso',
                'Sentinel Site': 'School',
            },
        };
        const leaf: Site = {
            ...parent,
            siteId: 2,
            locationHierarchy: { ...parent.locationHierarchy, Household: 'H1' },
        };
        const data = buildProgress(
            [
                program(
                    {
                        sessions: [session(1), session(2, { siteId: 2 })],
                        sites: [parent, leaf],
                        specimens: [
                            { id: 1, sessionId: 1, images: [{ id: 10 }] },
                            { id: 2, sessionId: 2, images: [{ id: 11 }] },
                        ],
                    },
                    3,
                    'Ghana',
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.coverageByProgram).toEqual([
            { programId: 3, unit: 'household', count: null },
        ]);
        expect(data.reportingLocations).toBeNull();
        expect(data.districts[0].reportingLocations).toBeNull();
        expect(data.uniqueScans).toBe(2);
    });

    it('keeps matching village names and numeric ids in different programs distinct', () => {
        const fields = {
            sessions: [session(1)],
            specimens: [{ id: 1, sessionId: 1, images: [{ id: 10 }] }],
        };
        const data = buildProgress([program(fields, 7), program(fields, 8)], {
            from: '2026-02',
            to: '2026-02',
        });
        expect(data.reportingLocations).toBe(2);
        expect(data.uniqueScans).toBe(2);
        expect(data.districts).toHaveLength(1);
        expect(data.districts[0]).toMatchObject({
            key: 'uganda:gulu',
            programIds: [7, 8],
            uniqueScans: 2,
            reportingLocations: 2,
        });
        expect(data.districts[0].monthly).toEqual([
            { month: '2026-02', uniqueScans: 2 },
        ]);
    });

    it('keeps districts with the same name in different countries geographically distinct', () => {
        const fields = {
            sessions: [session(1)],
            specimens: [{ id: 1, sessionId: 1, images: [{ id: 10 }] }],
        };
        const data = buildProgress(
            [program(fields, 7), program(fields, 8, 'Kenya')],
            {
                from: '2026-02',
                to: '2026-02',
            },
        );
        expect(data.districts.map(row => row.key).sort()).toEqual([
            'kenya:gulu',
            'uganda:gulu',
        ]);
        expect(data.districts).toHaveLength(2);
        expect(data.uniqueScans).toBe(2);
    });

    it('pools valid GPS across contributing programs when a district has no boundary anchor', () => {
        const data = buildProgress(
            [
                program(
                    {
                        sessions: [
                            session(1, { latitude: 2.7, longitude: 32.3 }),
                        ],
                    },
                    8,
                ),
                program(
                    {
                        sessions: [
                            session(1, { latitude: 3.1, longitude: 33.3 }),
                        ],
                    },
                    7,
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.districts).toHaveLength(1);
        expect(data.districts[0]).toMatchObject({
            programId: 7,
            programIds: [7, 8],
        });
        expect(data.districts[0].position?.latitude).toBeCloseTo(2.9);
        expect(data.districts[0].position?.longitude).toBeCloseTo(32.8);
    });

    it('keeps unknown district buckets per program without merging them geographically', () => {
        const fields = { sessions: [session(1, { siteId: 99 })] };
        const data = buildProgress([program(fields, 7), program(fields, 8)], {
            from: '2026-02',
            to: '2026-02',
        });
        expect(data.districts.map(row => row.key)).toEqual([
            'uganda:7:unknown',
            'uganda:8:unknown',
        ]);
        expect(data.districts.every(row => row.position === null)).toBe(true);
    });

    it('starts all history at the earliest eligible surveillance session', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [
                        session(1, {
                            type: 'PRACTICE',
                            collectionDate: Date.UTC(2020, 0, 1),
                        }),
                        session(2, { collectionDate: Date.UTC(2025, 11, 1) }),
                        session(3, { collectionDate: Date.UTC(2027, 0, 1) }),
                    ],
                }),
            ],
            { to: '2026-02' },
        );
        expect(data.from).toBe('2025-12');
        expect(data.monthly.map(row => row.month)).toEqual([
            '2025-12',
            '2026-01',
            '2026-02',
        ]);
    });

    it('distinguishes unavailable data from a successful empty program', () => {
        expect(buildProgress([], { to: '2026-02' })).toMatchObject({
            reportingLocations: null,
            uniqueScans: null,
            scansByProgram: [],
            lastUpdatedAt: null,
        });
        expect(buildProgress([program()], { to: '2026-02' })).toMatchObject({
            reportingLocations: 0,
            uniqueScans: 0,
            scansByProgram: [{ programId: 7, scans: 0 }],
            lastUpdatedAt: 100,
        });
    });
});
