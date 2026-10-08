import { describe, expect, it } from 'vitest';
import {
    matchCoverageBoundaries,
    type Boundary,
    type MultiPolygon,
} from './match-coverage-boundaries';
import type { CoverageUnit } from './parse-coverage-sheets';

const square = (x: number): MultiPolygon => ({
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

const uganda: Boundary[] = [
    { name: 'Gulu', geometry: square(1) },
    { name: 'Madi Okollo', geometry: square(2) },
    { name: 'Arua', geometry: square(3) },
    { name: 'Kampala', geometry: square(4) },
];

const unit = (
    name: string,
    overrides: Partial<CoverageUnit> = {},
): CoverageUnit => ({
    programId: 1,
    unit: name,
    status: 'Active',
    boundary: null,
    ...overrides,
});

describe('matchCoverageBoundaries', () => {
    it('matches names ignoring case, spaces and hyphens', () => {
        const { fills, unmatched } = matchCoverageBoundaries(
            [unit('GULU'), unit('Madi-Okollo', { status: 'Targeted' })],
            new Map([[1, uganda]]),
        );

        expect(unmatched).toEqual([]);
        expect(fills).toEqual([
            {
                programId: 1,
                unit: 'GULU',
                status: 'Active',
                geometry: square(1),
            },
            {
                programId: 1,
                unit: 'Madi-Okollo',
                status: 'Targeted',
                geometry: square(2),
            },
        ]);
    });

    it('draws a unit with the shape its boundary column names', () => {
        const { fills } = matchCoverageBoundaries(
            [unit('Arua-periurban', { boundary: 'Arua' })],
            new Map([[1, uganda]]),
        );

        expect(fills.map(f => [f.unit, f.geometry])).toEqual([
            ['Arua-periurban', square(3)],
        ]);
    });

    it('lists a unit with no shape, naming what was looked up', () => {
        const { fills, unmatched } = matchCoverageBoundaries(
            [unit('Arua-periurban'), unit('Gulu', { boundary: 'Guluu' })],
            new Map([[1, uganda]]),
        );

        expect(fills).toEqual([]);
        expect(unmatched).toEqual([
            {
                programId: 1,
                unit: 'Arua-periurban',
                lookedUp: 'Arua-periurban',
            },
            { programId: 1, unit: 'Gulu', lookedUp: 'Guluu' },
        ]);
    });

    it("looks only in the unit's own Program's boundaries", () => {
        const { unmatched } = matchCoverageBoundaries(
            [unit('Gulu', { programId: 4 })],
            new Map([[1, uganda]]),
        );

        expect(unmatched).toHaveLength(1);
    });

    it('draws no boundary that has no unit', () => {
        const { fills } = matchCoverageBoundaries(
            [unit('Gulu')],
            new Map([[1, uganda]]),
        );

        expect(fills.map(f => f.unit)).toEqual(['Gulu']);
    });
});
