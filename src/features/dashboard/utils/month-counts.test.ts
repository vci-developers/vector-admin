import type {
    ProgressDistrict,
    ProgressStephensi,
} from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import {
    scansInMonthByDistrict,
    speciesInMonthByDistrict,
    stephensiInMonthByDistrict,
} from './month-counts';

const gulu = {
    key: 'uganda:gulu',
    monthly: [
        { month: '2026-01', uniqueScans: 4 },
        { month: '2026-02', uniqueScans: 6 },
    ],
    speciesMonthly: [
        {
            month: '2026-01',
            species: [
                { name: 'Culex', specimens: 3 },
                { name: null, specimens: 1 },
            ],
        },
        { month: '2026-02', species: [{ name: 'Culex', specimens: 5 }] },
    ],
} as ProgressDistrict;

describe('scansInMonthByDistrict', () => {
    it('counts the month alone, not the months before it', () => {
        expect(scansInMonthByDistrict([gulu], '2026-02').get(gulu.key)).toBe(6);
    });

    it('keeps a District with no scans that month, at zero', () => {
        expect(scansInMonthByDistrict([gulu], '2026-03').get(gulu.key)).toBe(0);
    });
});

describe('speciesInMonthByDistrict', () => {
    it('counts one species in the month alone', () => {
        expect(
            speciesInMonthByDistrict([gulu], 'Culex', '2026-02').get(gulu.key),
        ).toBe(5);
    });

    it('reads calibration specimens by their series key', () => {
        expect(
            speciesInMonthByDistrict([gulu], 'calibration', '2026-01').get(
                gulu.key,
            ),
        ).toBe(1);
    });
});

describe('stephensiInMonthByDistrict', () => {
    const rows = [
        {
            programId: 1,
            species: 'An. stephensi',
            specimens: 3,
            latestMonth: '2026-02',
            districts: [
                {
                    key: 'kenya:turkana',
                    name: 'Turkana',
                    specimens: 3,
                    monthly: [
                        { month: '2026-01', specimens: 1 },
                        { month: '2026-02', specimens: 2 },
                    ],
                },
            ],
        },
    ] as ProgressStephensi[];

    it('counts the month alone and leaves out Districts with none', () => {
        expect([...stephensiInMonthByDistrict(rows, '2026-02')]).toEqual([
            ['kenya:turkana', 2],
        ]);
        expect(stephensiInMonthByDistrict(rows, '2026-03').size).toBe(0);
    });
});
