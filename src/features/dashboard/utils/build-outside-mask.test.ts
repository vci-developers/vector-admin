import { describe, expect, it } from 'vitest';
import { buildOutsideMask } from './build-outside-mask';
import type { MultiPolygon } from './match-coverage-boundaries';

const square = (x: number): [number, number][] => [
    [x, 0],
    [x + 1, 0],
    [x + 1, 1],
    [x, 1],
    [x, 0],
];

describe('buildOutsideMask', () => {
    it('cuts every piece of every country out of the world, ignoring lakes', () => {
        const lake = square(0.25);
        const withIsland: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[square(0), lake], [square(5)]],
        };
        const other: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [[square(10)]],
        };

        const [[world, ...holes]] = buildOutsideMask([
            withIsland,
            other,
        ]).coordinates;

        expect(world[0]).toEqual([-180, -90]);
        expect(holes).toEqual([square(0), square(5), square(10)]);
    });
});
