import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_DISTRICT } from './build-progress';
import {
    specimensByPlace,
    speciesSpecimensByDistrict,
    speciesTimelineFigures,
} from './species-timeline';

const gulu = {
    key: 'uganda:gulu',
    name: 'Gulu',
    country: 'Uganda',
    speciesMonthly: [
        {
            month: '2026-01',
            species: [
                { name: 'Culex', specimens: 2 },
                { name: 'An. gambiae', specimens: 4 },
            ],
        },
        { month: '2026-03', species: [{ name: 'Culex', specimens: 3 }] },
    ],
} as ProgressDistrict;

const unrecorded = {
    key: 'kenya:unknown',
    name: UNKNOWN_DISTRICT,
    country: 'Kenya',
    speciesMonthly: [
        { month: '2026-02', species: [{ name: 'Culex', specimens: 1 }] },
    ],
} as ProgressDistrict;

const months = ['2026-01', '2026-02', '2026-03'];

describe('speciesSpecimensByDistrict', () => {
    it('adds one species up to the month', () => {
        const counts = speciesSpecimensByDistrict([gulu], 'Culex', '2026-02');
        expect(counts.get('uganda:gulu')).toBe(2);
    });

    it('covers the whole period without a month', () => {
        const counts = speciesSpecimensByDistrict([gulu], 'Culex', null);
        expect(counts.get('uganda:gulu')).toBe(5);
    });

    it('keeps a District without the species, at zero', () => {
        const counts = speciesSpecimensByDistrict([gulu], 'Aedes', null);
        expect(counts.get('uganda:gulu')).toBe(0);
    });
});

describe('speciesTimelineFigures', () => {
    it('counts the species per month and where it was found so far', () => {
        expect(
            speciesTimelineFigures(
                [gulu, unrecorded],
                months,
                '2026-02',
                'Culex',
            ),
        ).toEqual({
            months: [
                { month: '2026-01', count: 2 },
                { month: '2026-02', count: 1 },
                { month: '2026-03', count: 3 },
            ],
            added: 1,
            // "District not recorded" is no area, but its country counts.
            areas: 1,
            countries: 2,
        });
    });

    it('finds nothing before the species first appears', () => {
        const figures = speciesTimelineFigures(
            [unrecorded],
            months,
            '2026-01',
            'Culex',
        );
        expect(figures).toMatchObject({ added: 0, areas: 0, countries: 0 });
    });
});

describe('specimensByPlace', () => {
    const lira = {
        ...gulu,
        key: 'uganda:lira',
        name: 'Lira',
    } as ProgressDistrict;
    const counts = new Map([
        ['uganda:gulu', 2],
        ['uganda:lira', 3],
        ['kenya:unknown', 4],
    ]);

    it('adds areas up by country, most first', () => {
        expect(
            specimensByPlace(counts, [gulu, lira, unrecorded], 'country'),
        ).toEqual([
            { key: 'Uganda', name: 'Uganda', specimens: 5 },
            { key: 'Kenya', name: 'Kenya', specimens: 4 },
        ]);
    });

    it('lists areas, naming the unrecorded one', () => {
        expect(
            specimensByPlace(counts, [gulu, unrecorded], 'area').map(
                place => place.name,
            ),
        ).toEqual(['Area not recorded', 'Gulu']);
    });

    it('leaves out places with none', () => {
        expect(
            specimensByPlace(new Map([['uganda:gulu', 0]]), [gulu], 'country'),
        ).toEqual([]);
    });
});
