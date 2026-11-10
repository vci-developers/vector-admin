import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_DISTRICT } from './build-progress';
import {
    countriesStartedBy,
    scansAsOf,
    scansInMonth,
    speciesAsOf,
    timelineFigures,
} from './scans-as-of';

const district = {
    key: 'uganda:gulu',
    name: 'Gulu',
    country: 'Uganda',
    uniqueScans: 9,
    monthly: [
        { month: '2026-01', uniqueScans: 2 },
        { month: '2026-02', uniqueScans: 0 },
        { month: '2026-03', uniqueScans: 7 },
    ],
    reportingMonths: ['2026-01', '2026-03'],
    speciesMonthly: [
        {
            month: '2026-01',
            species: [
                { name: 'An. gambiae', specimens: 2 },
                { name: null, specimens: 1 },
            ],
        },
        {
            month: '2026-03',
            species: [
                { name: 'An. funestus', specimens: 5 },
                { name: 'An. gambiae', specimens: 1 },
            ],
        },
    ],
} as ProgressDistrict;

describe('scansAsOf', () => {
    it('adds scans up to the month', () => {
        expect(scansAsOf([district], '2026-02')?.get(district.key)).toBe(2);
    });

    it('keeps a District that has not reported yet, at zero', () => {
        expect(scansAsOf([district], '2025-12')?.get(district.key)).toBe(0);
    });

    it('has nothing to say for the whole period', () => {
        expect(scansAsOf([district], null)).toBeUndefined();
    });
});

describe('scansInMonth', () => {
    it('lists only the Districts that scanned that month', () => {
        expect(scansInMonth([district], '2026-03').get(district.key)).toBe(7);
        expect(scansInMonth([district], '2026-02').size).toBe(0);
    });
});

describe('speciesAsOf', () => {
    it('leaves out species not seen yet', () => {
        expect(speciesAsOf([district], '2026-02')).toEqual([
            { name: 'An. gambiae', specimens: 2 },
            { name: null, specimens: 1 },
        ]);
    });

    it('adds months up across Districts, most first, unnamed last', () => {
        expect(speciesAsOf([district, district], '2026-03')).toEqual([
            { name: 'An. funestus', specimens: 10 },
            { name: 'An. gambiae', specimens: 6 },
            { name: null, specimens: 2 },
        ]);
    });

    it('has nothing to say for the whole period', () => {
        expect(speciesAsOf([district], null)).toBeUndefined();
    });
});

describe('timelineFigures', () => {
    const period = ['2026-01', '2026-02', '2026-03'];
    const late = {
        ...district,
        key: 'kenya:kilifi',
        name: 'Kilifi',
        country: 'Kenya',
        monthly: [
            { month: '2026-01', uniqueScans: 0 },
            { month: '2026-02', uniqueScans: 0 },
            { month: '2026-03', uniqueScans: 1 },
        ],
        speciesMonthly: [],
        reportingMonths: ['2026-03'],
    } as ProgressDistrict;

    it('counts only what has reported by the month', () => {
        expect(
            timelineFigures([district, late], period, '2026-02'),
        ).toMatchObject({
            added: 0,
            specimens: 3,
            areas: 1,
            countries: 1,
        });
    });

    it('keeps every month of the period for the line', () => {
        const figures = timelineFigures([district, late], period, '2026-03');
        expect(figures.months.map(row => row.scans)).toEqual([2, 0, 8]);
        expect(figures).toMatchObject({ added: 8, areas: 2, countries: 2 });
    });

    it('counts an upload with no images, as the tiles do', () => {
        const practice = {
            ...late,
            key: 'burundi:mpanda',
            name: 'Mpanda',
            country: 'Burundi',
            monthly: period.map(month => ({ month, uniqueScans: 0 })),
            reportingMonths: ['2026-02'],
        };
        expect(
            timelineFigures([district, practice], period, '2026-02'),
        ).toMatchObject({ added: 0, areas: 2, countries: 2 });
    });

    it('leaves an unrecorded area out of the areas, not the countries', () => {
        expect(
            timelineFigures(
                [{ ...late, name: UNKNOWN_DISTRICT }],
                period,
                '2026-03',
            ),
        ).toMatchObject({ areas: 0, countries: 1 });
    });
});

describe('countriesStartedBy', () => {
    const area = (country: string, reportingMonths: string[]) =>
        ({
            ...district,
            key: country,
            country,
            reportingMonths,
        }) as ProgressDistrict;

    it('lists the countries that have uploaded by the month', () => {
        const districts = [
            area('Uganda', ['2026-01']),
            area('Burundi', ['2026-11']),
        ];
        expect([...countriesStartedBy(districts, '2026-10')!]).toEqual([
            'Uganda',
        ]);
        expect(countriesStartedBy(districts, '2026-11')!.size).toBe(2);
        expect(countriesStartedBy(districts, null)).toBeUndefined();
    });
});
