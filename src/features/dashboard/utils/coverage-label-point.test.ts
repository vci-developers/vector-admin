import { describe, expect, it } from 'vitest';
import { coverageLabelPoint } from './coverage-label-point';
import type { MultiPolygon } from './match-coverage-boundaries';

const square = (lon: number, lat: number, size: number) => [
    [
        [lon, lat],
        [lon + size, lat],
        [lon + size, lat + size],
        [lon, lat + size],
        [lon, lat],
    ] as [number, number][],
];

describe('coverageLabelPoint', () => {
    it('puts the label at the centre of a shape, as [latitude, longitude]', () => {
        const geometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [square(32, 2, 2)],
        };

        expect(coverageLabelPoint(geometry)).toEqual({ at: [3, 33], area: 4 });
    });

    it('labels the largest piece, not the average of all pieces', () => {
        const geometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [square(40, 0, 0.1), square(30, 0, 4)],
        };

        expect(coverageLabelPoint(geometry)?.at).toEqual([2, 32]);
    });

    it('gives no point for a shape with no area', () => {
        const geometry: MultiPolygon = {
            type: 'MultiPolygon',
            coordinates: [
                [
                    [
                        [30, 0],
                        [31, 0],
                        [30, 0],
                    ],
                ],
            ],
        };

        expect(coverageLabelPoint(geometry)).toBeNull();
    });
});
