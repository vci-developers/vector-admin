import type { ProgressSnapshot } from '@/api/admin/load-progress-snapshot';
import type {
    ProgressSession,
    ProgressSessionCount,
} from '@/api/progress/validation/progress-snapshot-schema';
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
    submittedAt: FEB,
    collectionDate: MAR,
    latitude: 2.77,
    longitude: 32.3,
    ...fields,
});

const counts = (
    sessionId: number,
    imageCount: number,
    specimenCount = imageCount,
    groups: ProgressSessionCount['groups'] = [],
): ProgressSessionCount => ({ sessionId, specimenCount, imageCount, groups });

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
        specimenCounts: [],
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
                    specimenCounts: [counts(1, 200, 100)],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(200);
        expect(data.scansByProgram).toEqual([
            { programId: 7, scans: 200, specimens: 100 },
        ]);
        expect(data.uniqueSpecimens).toBe(100);
        expect(data.monthly).toEqual([{ month: '2026-02', uniqueScans: 200 }]);
        expect(data.districts[0].uniqueScans).toBe(200);
        expect(data.districts[0].scansByProgram).toEqual(data.scansByProgram);
        expect(data.reportingLocations).toBe(1);
    });

    it('retains locations with no images', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [session(1), session(2, { siteId: 3 })],
                    specimenCounts: [counts(1, 3, 2), counts(2, 0, 1)],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(3);
        expect(data.reportingLocations).toBe(2);
        expect(data.districts[0].uniqueScans).toBe(3);
    });

    it('lists specimens per species, most first, with blank species last', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [session(1), session(2, { siteId: 2 })],
                    sites: [house(1), { ...house(2), district: 'Lira' }],
                    specimenCounts: [
                        counts(1, 2, 2, [
                            { species: 'Anopheles funestus', count: 1 },
                            { species: 'Anopheles gambiae', count: 1 },
                        ]),
                        // Groups also split by sex and abdomen; blank is none.
                        counts(2, 3, 3, [
                            { species: 'Anopheles gambiae', count: 1 },
                            { species: '  ', count: 1 },
                            { species: null, count: 1 },
                        ]),
                    ],
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.species).toEqual([
            { name: 'Anopheles gambiae', specimens: 2 },
            { name: 'Anopheles funestus', specimens: 1 },
            { name: null, specimens: 2 },
        ]);
        expect(
            data.districts.map(({ name, species }) => ({ name, species })),
        ).toEqual([
            {
                name: 'Gulu',
                species: [
                    { name: 'Anopheles funestus', specimens: 1 },
                    { name: 'Anopheles gambiae', specimens: 1 },
                ],
            },
            {
                name: 'Lira',
                species: [
                    { name: 'Anopheles gambiae', specimens: 1 },
                    { name: null, specimens: 2 },
                ],
            },
        ]);
    });

    it('counts surveillance, calibration and training sessions but not CALIBRATION', () => {
        const data = buildProgress(
            [
                program({
                    sessions: [
                        session(1),
                        session(2, { type: 'PRACTICE', siteId: 2 }),
                        session(3, { type: 'CALIBRATION' }),
                        session(4, { type: 'DATA_COLLECTION' }),
                    ],
                    specimenCounts: [1, 2, 3, 4].map(id => counts(id, 2, 1)),
                }),
            ],
            { from: '2026-02', to: '2026-02' },
        );
        expect(data.uniqueScans).toBe(6);
        expect(data.reportingLocations).toBe(2);
    });

    it('attributes shared districts to their contributing programs while reconciling zero catches', () => {
        const data = buildProgress(
            [
                program({}, 9),
                program(
                    {
                        sessions: [
                            session(1),
                            session(2, { siteId: 2 }),
                            session(3, { submittedAt: MAR }),
                            session(4, { type: '' }),
                            session(5, { type: 'CALIBRATION' }),
                        ],
                        sites: [house(1), { ...house(2), district: 'Lira' }],
                        specimenCounts: [
                            counts(1, 1),
                            counts(2, 0, 1),
                            counts(3, 1),
                            counts(4, 1),
                            counts(5, 1),
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
                        specimenCounts: [
                            counts(1, 2),
                            counts(2, 3, 1),
                            counts(3, 1),
                        ],
                    },
                    7,
                ),
            ],
            { from: '2026-02', to: '2026-02' },
        );

        expect(data.scansByProgram).toEqual([
            { programId: 7, scans: 5, specimens: 3 },
            { programId: 8, scans: 1, specimens: 2 },
            { programId: 9, scans: 0, specimens: 0 },
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
                    { programId: 7, scans: 2, specimens: 2 },
                    { programId: 8, scans: 1, specimens: 1 },
                ],
            },
            {
                name: 'Lira',
                scansByProgram: [
                    { programId: 7, scans: 3, specimens: 1 },
                    { programId: 8, scans: 0, specimens: 1 },
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

    it('reconciles scans, districts and local reporting months while including zero catches and missing GPS', () => {
        const first = session(1, {
            // February in Kampala, despite January in UTC.
            submittedAt: Date.UTC(2026, 0, 31, 22),
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
                        session(5, { type: 'CALIBRATION' }),
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
                    specimenCounts: [
                        counts(1, 2),
                        counts(3, 1),
                        counts(4, 1),
                        counts(5, 1),
                        counts(6, 1),
                        counts(100, 1), // No such Session.
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
        expect(data.scansByProgram).toEqual([
            { programId: 7, scans: 0, specimens: 0 },
        ]);
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

    it('merges collection-site district names and places them using committed boundaries', () => {
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

    it('reconciles Cameroon scans, months and health-district coverage while keeping districts in the same region separate', () => {
        const sites: Site[] = [
            {
                siteId: 1,
                name: null,
                locationHierarchy: {
                    Region: 'Centre',
                    'Health District': 'Esse',
                    District: 'Ward A',
                },
            },
            {
                siteId: 2,
                name: null,
                locationHierarchy: {
                    Region: 'Centre',
                    'Health District': 'Esse',
                    District: 'Ward B',
                },
            },
            {
                siteId: 3,
                name: null,
                locationHierarchy: {
                    Region: 'Centre',
                    'Health District': 'Mbandjock',
                },
            },
            {
                siteId: 4,
                name: null,
                locationHierarchy: {
                    Region: 'North',
                    'Health District': 'Lagdo',
                },
            },
            {
                siteId: 5,
                name: null,
                locationHierarchy: { 'Health District': 'Unmapped district' },
            },
            {
                siteId: 6,
                name: null,
                locationHierarchy: {
                    Region: 'Ouest',
                    'Health District': 'Foumbot',
                },
            },
        ];
        const data = buildProgress(
            [
                program(
                    {
                        sites,
                        sessions: sites.map(({ siteId }) =>
                            session(siteId, {
                                siteId,
                                submittedAt: siteId <= 2 ? FEB : MAR,
                                latitude: 40.7,
                                longitude: -74,
                            }),
                        ),
                        specimenCounts: [
                            counts(1, 2, 1),
                            counts(2, 1),
                            counts(3, 1),
                            counts(4, 1),
                            counts(5, 1),
                        ],
                    },
                    6,
                    'Cameroon',
                ),
            ],
            { from: '2026-02', to: '2026-03' },
        );

        expect(data.uniqueScans).toBe(6);
        expect(data.scansByProgram).toEqual([
            { programId: 6, scans: 6, specimens: 5 },
        ]);
        expect(data.coverageByProgram).toEqual([
            { programId: 6, unit: 'health-district', count: 5 },
        ]);
        expect(data.monthly).toEqual([
            { month: '2026-02', uniqueScans: 3 },
            { month: '2026-03', uniqueScans: 3 },
        ]);
        expect(
            data.districts.map(area => ({
                name: area.name,
                scans: area.uniqueScans,
                locations: area.reportingLocations,
                position: area.position,
            })),
        ).toEqual([
            { name: 'Esse', scans: 3, locations: 1, position: null },
            { name: 'Foumbot', scans: 0, locations: 1, position: null },
            { name: 'Lagdo', scans: 1, locations: 1, position: null },
            { name: 'Mbandjock', scans: 1, locations: 1, position: null },
            {
                name: 'Unmapped',
                scans: 1,
                locations: 1,
                position: null,
            },
        ]);
        expect(
            data.districts.reduce((total, area) => total + area.uniqueScans, 0),
        ).toBe(data.uniqueScans);
        expect(
            data.districts.reduce(
                (total, area) => total + (area.reportingLocations ?? 0),
                0,
            ),
        ).toBe(data.reportingLocations);
        for (const month of data.monthly)
            expect(
                data.districts.reduce(
                    (total, area) =>
                        total +
                        (area.monthly.find(row => row.month === month.month)
                            ?.uniqueScans ?? 0),
                    0,
                ),
            ).toBe(month.uniqueScans);
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
                        specimenCounts: [counts(1, 1), counts(2, 1)],
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
            specimenCounts: [counts(1, 1)],
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
            specimenCounts: [counts(1, 1)],
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

    it('leaves site areas without a boundary anchor unplaced even when session GPS is available', () => {
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
        expect(data.districts[0].name).toBe('Gulu');
        expect(data.districts[0].position).toBeNull();
    });

    it('keeps collection-site attribution, placement and counts identical when session GPS is elsewhere or absent', () => {
        const source = program({
            sessions: [
                session(1, { latitude: 40.7, longitude: -74 }),
                session(2, { siteId: 2, latitude: 2.77, longitude: 32.3 }),
            ],
            specimenCounts: [counts(1, 2, 1), counts(2, 1)],
        });
        const withoutGps = {
            ...source,
            snapshot: {
                ...source.snapshot,
                sessions: source.snapshot.sessions.map(row => ({
                    ...row,
                    latitude: undefined,
                    longitude: undefined,
                })),
            },
        };
        const range = { from: '2026-02', to: '2026-02' };
        const anchor = { latitude: 2.8, longitude: 32.4 };
        const anchors = new Map([['uganda:gulu', anchor]]);
        const result = buildProgress([source], range, anchors);

        expect(result).toEqual(buildProgress([withoutGps], range, anchors));
        expect(result.uniqueScans).toBe(3);
        expect(result.reportingLocations).toBe(2);
        expect(result.districts).toHaveLength(1);
        expect(result.districts[0]).toMatchObject({
            key: 'uganda:gulu',
            name: 'Gulu',
            position: anchor,
            reportingLocations: 2,
            uniqueScans: 3,
        });
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
                            type: 'CALIBRATION',
                            submittedAt: Date.UTC(2020, 0, 1),
                        }),
                        session(2, { submittedAt: Date.UTC(2025, 11, 1) }),
                        session(3, { submittedAt: Date.UTC(2027, 0, 1) }),
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
