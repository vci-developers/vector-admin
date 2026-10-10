import localGeography from '@/features/dashboard/data/progress-geography.json';
import ghanaAreas from '@/features/dashboard/data/progress-areas-ghana.json';
import kenyaAreas from '@/features/dashboard/data/progress-areas-kenya.json';
import colombiaAreas from '@/features/dashboard/data/progress-areas-colombia.json';
import cameroonAreas from '@/features/dashboard/data/progress-areas-cameroon.json';
import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import {
    multiPolygonSchema,
    type Boundary,
    type MultiPolygon,
} from './match-coverage-boundaries';
import {
    matchProgressDistrictBoundaries,
    progressAreaBoundaries,
    progressMapPlacement,
} from './match-progress-district-boundaries';

const polygon: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
        [
            [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
            ],
        ],
    ],
};
const anotherPolygon: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
        [
            [
                [2, 2],
                [3, 2],
                [3, 3],
                [2, 2],
            ],
        ],
    ],
};

function district(
    name: string,
    overrides: Partial<ProgressDistrict> = {},
): ProgressDistrict {
    return {
        key: `uganda:${name.toLowerCase()}`,
        country: 'Uganda',
        name,
        programId: 7,
        programIds: [7],
        uniqueScans: 5,
        scansByProgram: [
            {
                programId: overrides.programId ?? 7,
                scans: overrides.uniqueScans ?? 5,
            },
        ],
        reportingLocations: 3,
        coverageByProgram: [
            {
                programId: overrides.programId ?? 7,
                unit: 'collection-site',
                count:
                    overrides.reportingLocations === undefined
                        ? 3
                        : overrides.reportingLocations,
            },
        ],
        monthly: [{ month: '2026-09', uniqueScans: 5 }],
        position: { latitude: 2.8, longitude: 32.3 },
        latestReceivedAt: 1,
        ...overrides,
    };
}

describe('matchProgressDistrictBoundaries', () => {
    it('does not flag Antioquia as unplaced when its known boundary can be drawn without a point', () => {
        const rows = [
            district('Antioquia', {
                country: 'Colombia',
                key: 'colombia:antioquia',
                position: null,
            }),
            district('New reporting area', {
                country: 'Colombia',
                key: 'colombia:new',
                position: null,
            }),
            district('Point fallback', {
                country: 'Colombia',
                key: 'colombia:point',
                position: { latitude: 6, longitude: -75 },
            }),
        ];
        const original = structuredClone(rows);
        const { fills } = matchProgressDistrictBoundaries(
            rows,
            new Map([['Colombia', progressAreaBoundaries(colombiaAreas)]]),
        );
        const placement = progressMapPlacement(rows, fills);

        expect(fills.map(fill => fill.district.key)).toEqual([
            'colombia:antioquia',
        ]);
        expect(placement.source).toBe(rows);
        expect(placement.unplaced).toEqual([rows[1]]);
        expect(rows).toEqual(original);
        expect(progressMapPlacement(rows, []).unplaced).toEqual([
            rows[0],
            rows[1],
        ]);
    });

    it('matches all eighteen recorded reporting areas to their actual public polygons at the reviewed country level', () => {
        const names = [
            {
                country: 'Ghana',
                programId: 3,
                names: [
                    'Tarkwa Nsuaem',
                    'Ada East',
                    'Ejura Sekyeredumase',
                    'Yendi Municipal',
                ],
            },
            { country: 'Kenya', programId: 4, names: ['Turkana'] },
            {
                country: 'Colombia',
                programId: 2,
                names: [
                    'Antioquia',
                    'Putumayo',
                    'Valle del Cauca',
                    'Chocó',
                    'Bogotá D.C',
                    'Amazonas',
                    'Boyacá',
                ],
            },
            {
                country: 'Cameroon',
                programId: 6,
                names: [
                    'Lagdo',
                    'Tibati',
                    'Foumbot',
                    'Esse',
                    'Mbandjock',
                    'Dibombari',
                ],
            },
        ];
        const boundaries = new Map(
            [ghanaAreas, kenyaAreas, colombiaAreas, cameroonAreas].map(
                areas => [areas.country, progressAreaBoundaries(areas)],
            ),
        );
        const rows = names.flatMap(({ country, programId, names }) =>
            names.map(name =>
                district(name, {
                    country,
                    programId,
                    programIds: [programId],
                    key: `${country.toLowerCase()}:${name}`,
                    position: null,
                }),
            ),
        );
        const result = matchProgressDistrictBoundaries(rows, boundaries);

        expect(result.unmatched).toEqual([]);
        expect(result.fills).toHaveLength(18);
        expect(result.fills.map(fill => fill.district)).toEqual(rows);
        expect(kenyaAreas.level).toBe('ADM1');
        expect(colombiaAreas.level).toBe('ADM1');
        expect(ghanaAreas.level).toBe('ADM2');
        expect(cameroonAreas.level).toBe('Health District (UNAIDS level 3)');
        expect(
            cameroonAreas.features.every(feature =>
                feature.properties.sourceId.startsWith('CMR_3_'),
            ),
        ).toBe(true);
        expect(
            boundaries
                .get('Ghana')!
                .find(boundary => boundary.name === 'Ejura-sekyedumase')!
                .sourceId,
        ).toBe('2480657B28564915274944');
        expect(
            boundaries
                .get('Colombia')!
                .find(boundary => boundary.name === 'Bogota Capital District')!
                .sourceId,
        ).toBe('13589884B40908771570386');
        for (const [index, fill] of result.fills.entries()) {
            expect(fill.district).toBe(rows[index]);
            expect(fill.district.position).toBeNull();
            expect(fill.district.uniqueScans).toBe(5);
            expect(fill.geometry.coordinates.length).toBeGreaterThan(0);
        }
    });

    it('keeps reviewed spelling aliases country-scoped and leaves unregistered names on point fallback', () => {
        const rows = [
            district('Bogotá D.C', { country: 'Ghana', key: 'ghana:bogota' }),
            district('Ejura Sekyeredumase', {
                country: 'Kenya',
                key: 'kenya:ejura',
            }),
            district('New reporting area', {
                country: 'Colombia',
                key: 'colombia:new',
            }),
        ];
        const result = matchProgressDistrictBoundaries(
            rows,
            new Map([
                ['Ghana', progressAreaBoundaries(ghanaAreas)],
                ['Kenya', progressAreaBoundaries(kenyaAreas)],
                ['Colombia', progressAreaBoundaries(colombiaAreas)],
            ]),
        );

        expect(result.fills).toEqual([]);
        expect(result.unmatched).toEqual(rows);
    });

    it('rejects aliases shared by different source polygons without rejecting duplicate spellings on one polygon', () => {
        const row = district('Bogotá D.C', {
            country: 'Colombia',
            key: 'colombia:bogota',
        });
        const boundary = {
            name: 'Bogota Capital District',
            aliases: ['Bogotá D.C', 'Bogotá D.C'],
            geometry: polygon,
        };
        expect(
            matchProgressDistrictBoundaries(
                [row],
                new Map([['Colombia', [boundary]]]),
            ).fills,
        ).toEqual([{ district: row, geometry: polygon }]);
        const result = matchProgressDistrictBoundaries(
            [row],
            new Map([
                [
                    'Colombia',
                    [
                        boundary,
                        {
                            name: 'Different source polygon',
                            aliases: ['Bogotá D.C'],
                            geometry: anotherPolygon,
                        },
                    ],
                ],
            ]),
        );
        expect(result).toEqual({ fills: [], unmatched: [row] });
    });

    it('matches Madi-Okollo through separator/case normalization and retains original data references', () => {
        const row = district(' MADI-OKOLLO ');
        const boundary: Boundary = { name: 'Madi Okollo', geometry: polygon };
        const rows = [row];
        const boundaries = new Map([['Uganda', [boundary]]]);
        const before = structuredClone({ rows, boundaries });

        const result = matchProgressDistrictBoundaries(rows, boundaries);

        expect(result.unmatched).toEqual([]);
        expect(result.fills[0].district).toBe(row);
        expect(result.fills[0].geometry).toBe(polygon);
        expect({ rows, boundaries }).toEqual(before);
    });

    it('matches all eleven audited Uganda district names against the actual committed display polygons', () => {
        const boundaries: Boundary[] = localGeography.districts.features.map(
            feature => ({
                name: feature.properties.name,
                geometry: multiPolygonSchema.parse(feature.geometry),
            }),
        );
        const names = [
            'Adjumani',
            'Amudat',
            'Gulu',
            'Karenga',
            'Kitgum',
            'Koboko',
            'Madi-Okollo',
            'Mayuge',
            'Namutumba',
            'Oyam',
            'Yumbe',
        ];
        const rows = names.map(name => district(name));

        const result = matchProgressDistrictBoundaries(
            rows,
            new Map([['Uganda', boundaries]]),
        );

        expect(boundaries).toHaveLength(146);
        expect(result.unmatched).toEqual([]);
        expect(result.fills.map(fill => fill.district.name)).toEqual(names);
        const karenga = result.fills.find(
            fill => fill.district.name === 'Karenga',
        )!;
        expect(karenga.geometry).toBe(
            boundaries.find(boundary => boundary.name === 'Karenga')!.geometry,
        );
        expect(karenga.geometry).not.toBe(
            boundaries.find(boundary => boundary.name === 'Kaabong')!.geometry,
        );
    });

    it('scopes identical district names to their country and leaves unsupported countries unmatched', () => {
        const uganda = district('Central');
        const kenya = district('Central', {
            key: 'kenya:central',
            country: 'Kenya',
        });
        const ghana = district('Central', {
            key: 'ghana:central',
            country: 'Ghana',
        });
        const missingCountry = district('Central', {
            key: 'missing:central',
            country: '',
        });
        const result = matchProgressDistrictBoundaries(
            [uganda, kenya, ghana, missingCountry],
            new Map([
                ['Uganda', [{ name: 'Central', geometry: polygon }]],
                ['Kenya', [{ name: 'Central', geometry: anotherPolygon }]],
                ['', [{ name: 'Central', geometry: polygon }]],
            ]),
        );

        expect(result.fills[0]).toEqual({
            district: uganda,
            geometry: polygon,
        });
        expect(result.fills[1]).toEqual({
            district: kenya,
            geometry: anotherPolygon,
        });
        expect(result.unmatched).toEqual([ghana, missingCountry]);
    });

    it('keeps unknown or merely similar names unmatched without coordinate or alias guesses', () => {
        const unknown = district('District not recorded', {
            key: 'uganda:7:unknown',
        });
        const similar = district('Gulu City');
        const result = matchProgressDistrictBoundaries(
            [unknown, similar],
            new Map([
                [
                    'Uganda',
                    [
                        { name: 'Gulu', geometry: polygon },
                        {
                            name: 'District not recorded',
                            geometry: anotherPolygon,
                        },
                    ],
                ],
            ]),
        );

        expect(result.fills).toEqual([]);
        expect(result.unmatched).toEqual([unknown, similar]);
    });

    it('matches reported districts with zero scans and no GPS without changing their counts', () => {
        const row = district('Gulu', {
            position: null,
            uniqueScans: 0,
            monthly: [{ month: '2026-09', uniqueScans: 0 }],
        });
        const result = matchProgressDistrictBoundaries(
            [row],
            new Map([['Uganda', [{ name: 'Gulu', geometry: polygon }]]]),
        );

        expect(result.fills).toHaveLength(1);
        expect(result.fills[0].district).toBe(row);
        expect(result.fills[0].district).toMatchObject({
            uniqueScans: 0,
            reportingLocations: 3,
            position: null,
        });
    });

    it('rejects duplicate normalized boundary names rather than selecting the first or last shape', () => {
        const row = district('Madi-Okollo');
        const rows: Boundary[] = [
            { name: 'Madi Okollo', geometry: polygon },
            { name: 'MADI-OKOLLO', geometry: anotherPolygon },
            { name: 'madi_okollo', geometry: polygon },
        ];
        const forward = matchProgressDistrictBoundaries(
            [row],
            new Map([['Uganda', rows]]),
        );
        const reverse = matchProgressDistrictBoundaries(
            [row],
            new Map([['Uganda', rows.toReversed()]]),
        );

        expect(forward).toEqual({ fills: [], unmatched: [row] });
        expect(reverse).toEqual(forward);
    });
});
