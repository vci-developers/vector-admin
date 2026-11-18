import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import {
    buildSpeciesMonths,
    CALIBRATION_SPECIES,
    colorSpeciesSeries,
    seriesKeyOf,
} from './build-species-months';

const district = (
    speciesMonthly: ProgressDistrict['speciesMonthly'],
): ProgressDistrict => ({ speciesMonthly }) as ProgressDistrict;

describe('buildSpeciesMonths', () => {
    it('sums species per month across districts, in the given months', () => {
        const result = buildSpeciesMonths(
            [
                district([
                    {
                        month: '2026-01',
                        species: [{ name: 'An. gambiae', specimens: 3 }],
                    },
                ]),
                district([
                    {
                        month: '2026-01',
                        species: [{ name: 'An. gambiae', specimens: 2 }],
                    },
                    {
                        month: '2026-03',
                        species: [{ name: 'Culex', specimens: 4 }],
                    },
                ]),
            ],
            ['2026-01', '2026-02'],
        );
        expect(result.months).toEqual([
            { month: '2026-01', specimens: { 'An. gambiae': 5 } },
            { month: '2026-02', specimens: {} },
        ]);
    });

    it('gives every species a series, most first, calibration last', () => {
        const result = buildSpeciesMonths(
            [
                district([
                    {
                        month: '2026-01',
                        species: [
                            { name: null, specimens: 40 },
                            { name: 'Aedes', specimens: 2 },
                            { name: 'An. gambiae', specimens: 9 },
                            { name: 'An. stephensi', specimens: 1 },
                        ],
                    },
                ]),
            ],
            ['2026-01'],
        );
        expect(result.series).toEqual([
            { key: 'An. gambiae', name: 'An. gambiae', stephensi: false },
            { key: 'Aedes', name: 'Aedes', stephensi: false },
            { key: 'An. stephensi', name: 'An. stephensi', stephensi: true },
            {
                key: CALIBRATION_SPECIES,
                name: 'Calibration specimens',
                stephensi: false,
            },
        ]);
        expect(result.months[0].specimens[CALIBRATION_SPECIES]).toBe(40);
    });
});

describe('colorSpeciesSeries', () => {
    const series = (name: string, stephensi = false) => ({
        key: name,
        name,
        stephensi,
    });

    it('keeps a known species on its colour whatever else is shown', () => {
        const all = colorSpeciesSeries([
            series('Anopheles gambiae'),
            series('Culex'),
        ]);
        const culexAlone = colorSpeciesSeries([series('Culex')]);
        expect(all.map(row => row.color)).toEqual([
            'var(--progress-rainbow-1)',
            'var(--progress-rainbow-2)',
        ]);
        expect(culexAlone[0].color).toBe('var(--progress-rainbow-2)');
    });

    it('reads the "An." abbreviation as Anopheles', () => {
        expect(colorSpeciesSeries([series('An. funestus')])[0].color).toBe(
            'var(--progress-rainbow-4)',
        );
    });

    it('gives a new species the first colour not in use', () => {
        const colored = colorSpeciesSeries([
            series('Anopheles gambiae'),
            series('Coquillettidia'),
            series('Anopheles coustani'),
        ]);
        expect(colored.map(row => row.color)).toEqual([
            'var(--progress-rainbow-1)',
            'var(--progress-rainbow-2)',
            'var(--progress-rainbow-3)',
        ]);
    });

    it('skips colours a known species shown alongside holds', () => {
        const colored = colorSpeciesSeries([
            series('Coquillettidia'),
            series('Culex'),
            series('Anopheles gambiae'),
        ]);
        expect(colored[0].color).toBe('var(--progress-rainbow-3)');
    });

    it('gives stephensi, calibration and a bare "other" their own colours', () => {
        const colored = colorSpeciesSeries([
            series('An. stephensi', true),
            series('Other'),
            { ...series('Calibration specimens'), key: CALIBRATION_SPECIES },
        ]);
        expect(colored.map(row => row.color)).toEqual([
            'var(--progress-stephensi)',
            'var(--progress-species-other)',
            'var(--progress-species-calibration)',
        ]);
    });
});

describe('seriesKeyOf', () => {
    it('keys a species by name and no species as calibration', () => {
        expect(seriesKeyOf('Culex')).toBe('Culex');
        expect(seriesKeyOf(null)).toBe(CALIBRATION_SPECIES);
    });
});
