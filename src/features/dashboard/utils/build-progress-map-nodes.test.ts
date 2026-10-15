import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import {
    buildProgressMapNodes,
    progressMapDetailDistrictKeys,
    type ProgressMapPosition,
} from './build-progress-map-nodes';

const project = ({ latitude, longitude }: ProgressMapPosition) => ({
    x: longitude * 10,
    y: latitude * 10,
});

function district(
    key: string,
    x: number,
    y: number,
    overrides: Partial<ProgressDistrict> = {},
): ProgressDistrict {
    return {
        key,
        country: 'Uganda',
        name: key,
        programId: 7,
        programIds: [7],
        uniqueScans: 1,
        uniqueSpecimens: 0,
        species: [],
        sentinelSitesByProgram: [],
        scansByProgram: [
            {
                programId: overrides.programId ?? 7,
                scans: overrides.uniqueScans ?? 1,
                specimens: 0,
            },
        ],
        reportingLocations: 1,
        coverageByProgram: [
            {
                programId: overrides.programId ?? 7,
                unit: 'collection-site',
                count:
                    overrides.reportingLocations === undefined
                        ? 1
                        : overrides.reportingLocations,
            },
        ],
        position: { latitude: y / 10, longitude: x / 10 },
        monthly: [],
        latestReceivedAt: null,
        ...overrides,
    };
}

describe('buildProgressMapNodes', () => {
    it('hides granular areas below country overview zoom without losing zero-catch or scan totals', () => {
        const rows = [
            district('uganda:zero', 0, 0, { uniqueScans: 0 }),
            district('uganda:active', 400, 200, { uniqueScans: 12 }),
            district('ghana:active', 800, 200, {
                country: 'Ghana',
                uniqueScans: 5,
            }),
        ];
        const before = structuredClone(rows);
        const nodes = buildProgressMapNodes({
            districts: rows,
            zoom: 5.75,
            project,
            overviewZoom: 6,
        });

        expect(nodes.every(node => node.kind === 'country')).toBe(true);
        expect(progressMapDetailDistrictKeys(nodes).size).toBe(0);
        expect(nodes.reduce((total, node) => total + node.uniqueScans, 0)).toBe(
            17,
        );
        expect(nodes.flatMap(node => node.districtKeys).toSorted()).toEqual(
            rows.map(row => row.key).toSorted(),
        );
        expect(rows).toEqual(before);
    });

    it('reveals spread-out country areas before a compact country, then reveals both at detail zoom', () => {
        const rows = [
            district('uganda:a', 0, 0),
            district('uganda:b', 300, 200),
            district('ghana:a', 800, 0, { country: 'Ghana' }),
            district('ghana:b', 900, 40, { country: 'Ghana' }),
        ];
        const options = {
            districts: rows,
            project,
            overviewZoom: 6,
            overviewMaxZoom: 7,
            overviewFootprint: 190,
        };
        const intermediate = buildProgressMapNodes({ ...options, zoom: 6.5 });
        const detail = buildProgressMapNodes({ ...options, zoom: 7 });

        expect(
            [...progressMapDetailDistrictKeys(intermediate)].toSorted(),
        ).toEqual(['uganda:a', 'uganda:b']);
        expect(intermediate.find(node => node.country === 'Ghana')?.kind).toBe(
            'country',
        );
        expect([...progressMapDetailDistrictKeys(detail)].toSorted()).toEqual(
            rows.map(row => row.key).toSorted(),
        );
        expect(
            detail.reduce((total, node) => total + node.uniqueScans, 0),
        ).toBe(4);
    });

    it('keeps all coincident cluster members available to granular labels at detail zoom', () => {
        const rows = [district('uganda:a', 0, 0), district('uganda:b', 0, 0)];
        const [node] = buildProgressMapNodes({
            districts: rows,
            zoom: 9,
            project,
        });

        expect(node.kind).toBe('cluster');
        expect([...progressMapDetailDistrictKeys([node])]).toEqual([
            'uganda:a',
            'uganda:b',
        ]);
        expect(node.sourceDistricts[0]).toBe(rows[0]);
        expect(node.sourceDistricts[1]).toBe(rows[1]);
    });

    it('preserves the exact recorded position for an individual district', () => {
        const source = district('recorded', 0, 0, {
            position: { latitude: 1.234567, longitude: 32.345678 },
        });
        const [node] = buildProgressMapNodes({
            districts: [source],
            zoom: 9,
            project,
        });

        expect(node.kind).toBe('district');
        expect(node.position).toEqual(source.position);
    });

    it('aggregates located district records across programs into separate country summaries at overview zoom', () => {
        const rows = [
            district('uganda:gulu', 0, 0, {
                programIds: [7, 8],
                uniqueScans: 5,
                reportingLocations: 2,
                coverageByProgram: [
                    { programId: 7, unit: 'collection-site', count: 1 },
                    { programId: 8, unit: 'collection-site', count: 1 },
                ],
            }),
            district('uganda:lira', 200, 0, {
                programId: 8,
                programIds: [8],
                uniqueScans: 7,
                reportingLocations: 3,
            }),
            district('ghana:district', 0, 0, {
                country: 'Ghana',
                programId: 9,
                programIds: [9],
                uniqueScans: 4,
            }),
        ];
        const nodes = buildProgressMapNodes({
            districts: rows,
            zoom: 4,
            project,
        });

        expect(nodes).toHaveLength(2);
        const uganda = nodes.find(node => node.country === 'Uganda')!;
        expect(uganda).toMatchObject({
            key: 'country:uganda',
            kind: 'country',
            uniqueScans: 12,
            reportingLocations: 5,
            coverageByProgram: [
                { programId: 7, unit: 'collection-site', count: 1 },
                { programId: 8, unit: 'collection-site', count: 4 },
            ],
            districtKeys: ['uganda:gulu', 'uganda:lira'],
        });
        expect(uganda.sourceDistricts[0].programIds).toEqual([7, 8]);
        expect(uganda.position.longitude).toBeCloseTo((20 * 7) / 12);
    });

    it.each([
        { zoom: 4, kind: 'country' },
        { zoom: 9, kind: 'cluster' },
    ])(
        'keeps mixed coverage units separate in a $kind node',
        ({ zoom, kind }) => {
            const rows = [
                district('a', 0, 0, {
                    programId: 1,
                    programIds: [1],
                    uniqueScans: 5,
                    reportingLocations: 2,
                    coverageByProgram: [
                        { programId: 1, unit: 'household', count: 2 },
                    ],
                }),
                district('b', 30, 0, {
                    programId: 2,
                    programIds: [2],
                    uniqueScans: 7,
                    reportingLocations: 3,
                    coverageByProgram: [
                        { programId: 2, unit: 'community', count: 3 },
                    ],
                }),
            ];
            const before = structuredClone(rows);
            const [node] = buildProgressMapNodes({
                districts: rows,
                zoom,
                project,
            });

            expect(node).toMatchObject({
                kind,
                uniqueScans: 12,
                reportingLocations: null,
                coverageByProgram: [
                    { programId: 1, unit: 'household', count: 2 },
                    { programId: 2, unit: 'community', count: 3 },
                ],
                districtKeys: ['a', 'b'],
            });
            expect(node.sourceDistricts[0]).toBe(rows[0]);
            expect(node.sourceDistricts[1]).toBe(rows[1]);
            expect(rows).toEqual(before);
        },
    );

    it('propagates unavailable coverage metadata while retaining scans and known counts', () => {
        const rows = [
            district('a', 0, 0, {
                programId: 1,
                programIds: [1],
                uniqueScans: 2,
                reportingLocations: 2,
                coverageByProgram: [
                    { programId: 1, unit: 'household', count: 2 },
                ],
            }),
            district('b', 30, 0, {
                programId: 1,
                programIds: [1],
                uniqueScans: 3,
                reportingLocations: null,
                coverageByProgram: [
                    { programId: 1, unit: 'household', count: null },
                ],
            }),
            district('c', 200, 0, {
                programId: 3,
                programIds: [3],
                uniqueScans: 4,
                reportingLocations: 4,
                coverageByProgram: [
                    { programId: 3, unit: 'household', count: 4 },
                ],
            }),
        ];
        const [node] = buildProgressMapNodes({
            districts: rows,
            zoom: 4,
            project,
        });

        expect(node).toMatchObject({
            uniqueScans: 9,
            reportingLocations: null,
            coverageByProgram: [
                { programId: 1, unit: 'household', count: null },
                { programId: 3, unit: 'household', count: 4 },
            ],
        });
        expect(node.sourceDistricts).toEqual(rows);
        expect(rows[0].coverageByProgram[0].count).toBe(2);
        expect(rows[1].coverageByProgram[0].count).toBeNull();
    });

    it('uses a country summary for a compact projected footprint at higher zoom', () => {
        const nodes = buildProgressMapNodes({
            districts: [district('a', 0, 0), district('b', 70, 50)],
            zoom: 6.5,
            project,
            overviewFootprint: 88,
        });

        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
            kind: 'country',
            districtKeys: ['a', 'b'],
            uniqueScans: 2,
        });
    });

    it('switches coincident district points from a country summary to a cluster at detailed zoom', () => {
        const districts = [
            district('a', 0, 0, { uniqueScans: 3 }),
            district('b', 0, 0, { uniqueScans: 5 }),
        ];
        const options = {
            districts,
            project,
            overviewZoom: 5.5,
            overviewMaxZoom: 7,
            overviewFootprint: 190,
        };
        const [overview] = buildProgressMapNodes({ ...options, zoom: 6.5 });
        const [detail] = buildProgressMapNodes({ ...options, zoom: 12 });

        expect(overview.kind).toBe('country');
        expect(detail).toMatchObject({
            kind: 'cluster',
            districtKeys: ['a', 'b'],
            uniqueScans: 8,
            reportingLocations: 2,
        });
        expect(detail.position).toEqual(districts[0].position);
    });

    it('clusters nearby points at detailed zoom and keeps distant districts separate', () => {
        const nodes = buildProgressMapNodes({
            districts: [
                district('a', 0, 0, { uniqueScans: 3 }),
                district('b', 30, 0, { uniqueScans: 1 }),
                district('c', 200, 0),
            ],
            zoom: 8,
            project,
        });

        expect(nodes).toHaveLength(2);
        const cluster = nodes.find(node => node.kind === 'cluster')!;
        expect(cluster).toMatchObject({
            districtKeys: ['a', 'b'],
            uniqueScans: 4,
            reportingLocations: 2,
        });
        expect(cluster.projected.x).toBeCloseTo(7.5);
        expect(
            nodes.some(node => node.kind === 'district' && node.key === 'c'),
        ).toBe(true);
    });

    it('is input-order independent and never changes district records or the input array', () => {
        const rows = [
            district('z', 100, 0),
            district('b', 30, 0),
            district('a', 0, 0),
            district('y', 110, 0),
        ];
        const before = structuredClone(rows);
        const options = { zoom: 8, project, overviewFootprint: 0 };

        const forward = buildProgressMapNodes({ districts: rows, ...options });
        const reverse = buildProgressMapNodes({
            districts: rows.toReversed(),
            ...options,
        });

        expect(forward).toEqual(reverse);
        expect(rows).toEqual(before);
    });

    it('retains zero-catch activity and averages positions equally when a group has no scans', () => {
        const nodes = buildProgressMapNodes({
            districts: [
                district('a', 0, 0, { uniqueScans: 0, reportingLocations: 2 }),
                district('b', 20, 0, { uniqueScans: 0 }),
                district('c', 200, 0, { uniqueScans: 0 }),
            ],
            zoom: 8,
            project,
        });

        const cluster = nodes.find(node => node.kind === 'cluster')!;
        expect(cluster).toMatchObject({
            uniqueScans: 0,
            reportingLocations: 3,
            districtKeys: ['a', 'b'],
        });
        expect(cluster.projected.x).toBeCloseTo(10);
        expect(nodes.find(node => node.key === 'c')?.uniqueScans).toBe(0);
    });

    it('excludes missing-position records from map aggregates without altering their data', () => {
        const unknown = district('unknown', 0, 0, {
            position: null,
            uniqueScans: 99,
            reportingLocations: 9,
        });
        const nodes = buildProgressMapNodes({
            districts: [district('known', 0, 0, { uniqueScans: 3 }), unknown],
            zoom: 4,
            project,
        });

        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
            uniqueScans: 3,
            reportingLocations: 1,
            districtKeys: ['known'],
        });
        expect(unknown).toMatchObject({
            position: null,
            uniqueScans: 99,
            reportingLocations: 9,
        });
    });

    it('never merges different countries even when their projected points coincide', () => {
        const nodes = buildProgressMapNodes({
            districts: [
                district('uganda:a', 0, 0),
                district('kenya:b', 0, 0, { country: 'Kenya' }),
                district('uganda:c', 200, 0),
            ],
            zoom: 8,
            project,
            overviewFootprint: 0,
        });

        expect(nodes).toHaveLength(3);
        expect(nodes.every(node => node.kind === 'district')).toBe(true);
    });

    it('rechecks merged centres until no same-country nodes overlap at the requested distance', () => {
        const rows = Array.from({ length: 8 }, (_, index) =>
            district(
                `ring:${index}`,
                50 * Math.cos((index * Math.PI) / 4),
                50 * Math.sin((index * Math.PI) / 4),
            ),
        );
        rows.push(district('centre', 0, 0, { uniqueScans: 0 }));
        const nodes = buildProgressMapNodes({
            districts: rows,
            zoom: 9,
            project,
            clusterDistance: 44,
            overviewFootprint: 0,
        });

        expect(nodes.reduce((total, node) => total + node.uniqueScans, 0)).toBe(
            8,
        );
        expect(nodes.every(node => node.reportingLocations !== null)).toBe(
            true,
        );
        expect(
            nodes.reduce((total, node) => total + node.reportingLocations!, 0),
        ).toBe(9);
        expect(nodes.flatMap(node => node.districtKeys).toSorted()).toEqual(
            rows.map(row => row.key).toSorted(),
        );
        for (let first = 0; first < nodes.length; first++) {
            for (let second = first + 1; second < nodes.length; second++) {
                expect(
                    Math.hypot(
                        nodes[first].projected.x - nodes[second].projected.x,
                        nodes[first].projected.y - nodes[second].projected.y,
                    ),
                ).toBeGreaterThan(44);
            }
        }
    });

    it('keeps an antimeridian country summary near its actual longitudes', () => {
        const nodes = buildProgressMapNodes({
            districts: [district('a', 1790, 0), district('b', -1790, 0)],
            zoom: 4,
            project,
        });

        expect(Math.abs(nodes[0].position.longitude)).toBeCloseTo(180);
    });
});
