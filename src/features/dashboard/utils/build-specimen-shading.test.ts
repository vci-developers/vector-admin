import type { AreaMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import { areaSessionIds, buildSpecimenShading } from './build-specimen-shading';
import type { ProgressAreaBoundary } from './match-progress-district-boundaries';
import { progressScanFillColor } from './progress-map-colors';

const square = (x: number): ProgressAreaBoundary['geometry'] => ({
    type: 'MultiPolygon',
    coordinates: [
        [
            [
                [x, 0],
                [x + 1, 0],
                [x + 1, 1],
                [x, 0],
            ],
        ],
    ],
});

const area = (
    programId: number,
    name: string | null,
    uniqueSpecimens: number,
) =>
    ({
        programId,
        level: 'District',
        name,
        metrics: { uniqueSpecimens },
    }) as AreaMetricsDto;

const countryOf = new Map([
    [1, 'Uganda'],
    [2, 'Ghana'],
    [3, 'Colombia'],
]);

describe('buildSpecimenShading', () => {
    it('shades matched areas on one scale, darkest for the most specimens', () => {
        const shades = buildSpecimenShading({
            areas: [
                area(1, 'Gulu', 50),
                area(1, 'Oyam', 200),
                area(3, 'Antioquía', 10),
            ],
            sessions: [],
            sitePaths: {},
            countryOf,
            boundariesByCountry: new Map([
                [
                    'Uganda',
                    [
                        { name: 'Gulu', geometry: square(0) },
                        { name: 'Oyam', geometry: square(1) },
                    ],
                ],
                ['Colombia', [{ name: 'Antioquia', geometry: square(2) }]],
            ]),
        });

        expect(shades.map(s => [s.key, s.specimens])).toEqual([
            ['1/Gulu', 50],
            ['1/Oyam', 200],
            ['3/Antioquía', 10],
        ]);
        expect(shades[1].fillColor).toBe(progressScanFillColor(200, 200));
        expect(shades[0].fillColor).toBe(progressScanFillColor(50, 200));
    });

    it('skips unnamed, unmatched and ambiguous areas', () => {
        const shades = buildSpecimenShading({
            areas: [
                area(1, null, 5),
                area(1, 'Nowhere', 5),
                area(1, 'Twin', 5),
            ],
            sessions: [],
            sitePaths: {},
            countryOf,
            boundariesByCountry: new Map([
                [
                    'Uganda',
                    [
                        { name: 'Twin', geometry: square(0) },
                        { name: 'Twin', geometry: square(1) },
                    ],
                ],
            ]),
        });

        expect(shades).toEqual([]);
    });

    it('counts one level down when no top-level area has a boundary', () => {
        const shades = buildSpecimenShading({
            areas: [area(2, 'Ashanti', 30)],
            sessions: [
                { programId: 2, siteId: 7, specimenCount: 10 },
                { programId: 2, siteId: 8, specimenCount: 20 },
            ],
            sitePaths: {
                7: [{ name: 'Ashanti' }, { name: 'Ejura Sekyeredumase' }],
                8: [{ name: 'Ashanti' }, { name: 'Ejura Sekyeredumase' }],
            },
            countryOf,
            boundariesByCountry: new Map([
                [
                    'Ghana',
                    [
                        {
                            name: 'Ejura-sekyedumase',
                            aliases: ['Ejura Sekyeredumase'],
                            geometry: square(0),
                        },
                    ],
                ],
            ]),
        });

        expect(shades.map(s => [s.key, s.specimens])).toEqual([
            ['2/Ejura Sekyeredumase', 30],
        ]);
    });
});

describe('areaSessionIds', () => {
    it("picks the Program's Sessions whose path names the area at its level", () => {
        const at = (
            sessionId: number,
            programId: number,
            ...names: string[]
        ) => ({
            sessionId,
            programId,
            location: names.map(name => ({ name })),
        });

        expect(
            areaSessionIds(
                { programId: 2, name: 'Ejura Sekyeredumase', depth: 1 },
                [
                    at(1, 2, 'Ashanti', 'Ejura Sekyeredumase', 'Village A'),
                    at(2, 2, 'Ashanti', 'Other District'),
                    at(3, 2, 'Ejura Sekyeredumase'),
                    at(4, 9, 'Ashanti', 'Ejura Sekyeredumase'),
                ],
            ),
        ).toEqual([1]);
    });
});
