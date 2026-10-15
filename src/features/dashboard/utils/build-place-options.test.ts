import { describe, expect, it } from 'vitest';
import { buildPlaceOptions, selectedPlaceKey } from './build-place-options';
import type { MultiPolygon } from './match-coverage-boundaries';

const shape: MultiPolygon = {
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

describe('buildPlaceOptions', () => {
    it('lists countries, then areas, then units, each alphabetical and named by country', () => {
        const options = buildPlaceOptions({
            outlines: [
                { country: 'Uganda', geometry: shape },
                { country: 'Ghana', geometry: shape },
            ],
            areas: [
                { programId: 1, name: 'Lira', depth: 0, geometry: shape },
                { programId: 1, name: 'Gulu', depth: 0, geometry: shape },
            ],
            units: [
                {
                    programId: 2,
                    unit: 'Tamale',
                    status: 'Active',
                    geometry: shape,
                },
            ],
            countryOf: new Map([
                [1, 'Uganda'],
                [2, 'Ghana'],
            ]),
        });

        expect(options.map(o => [o.kind, o.name, o.country])).toEqual([
            ['country', 'Ghana', null],
            ['country', 'Uganda', null],
            ['area', 'Gulu', 'Uganda'],
            ['area', 'Lira', 'Uganda'],
            ['unit', 'Tamale', 'Ghana'],
        ]);
    });
});

describe('selectedPlaceKey', () => {
    it("matches the option key of the selection's place", () => {
        const [country, area] = buildPlaceOptions({
            outlines: [{ country: 'Uganda', geometry: shape }],
            areas: [{ programId: 1, name: 'Gulu', depth: 0, geometry: shape }],
            units: [],
            countryOf: new Map([[1, 'Uganda']]),
        });

        expect(selectedPlaceKey({ country: 'Uganda' })).toBe(country.key);
        expect(
            selectedPlaceKey({
                area: { programId: 1, name: 'Gulu', depth: 0 },
            }),
        ).toBe(area.key);
    });

    it('is null for a selection of points, which names no place', () => {
        expect(selectedPlaceKey({})).toBeNull();
        expect(selectedPlaceKey(null)).toBeNull();
    });
});
