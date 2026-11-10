import type { ProgressStephensi } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import { sumStephensiByDistrict, sumStephensiMonths } from './stephensi-totals';

const rows: ProgressStephensi[] = [
    {
        programId: 1,
        species: 'An. stephensi',
        specimens: 3,
        latestMonth: '2026-03',
        districts: [
            {
                key: 'uganda:amudat',
                name: 'Amudat',
                specimens: 3,
                monthly: [
                    { month: '2026-02', specimens: 1 },
                    { month: '2026-03', specimens: 2 },
                ],
            },
        ],
    },
    {
        programId: 1,
        species: 'An. stephensi (suspected)',
        specimens: 5,
        latestMonth: '2026-03',
        districts: [
            {
                key: 'uganda:amudat',
                name: 'Amudat',
                specimens: 1,
                monthly: [{ month: '2026-03', specimens: 1 }],
            },
            {
                key: 'uganda:gulu',
                name: 'Gulu',
                specimens: 4,
                monthly: [{ month: '2026-03', specimens: 4 }],
            },
        ],
    },
];

describe('sumStephensiMonths', () => {
    it('adds every label per month and keeps empty months', () => {
        expect(
            sumStephensiMonths(['2026-01', '2026-02', '2026-03'], rows, null),
        ).toEqual([
            { month: '2026-01', count: 0 },
            { month: '2026-02', count: 1 },
            { month: '2026-03', count: 7 },
        ]);
    });

    it('counts only the selected District', () => {
        expect(
            sumStephensiMonths(['2026-02', '2026-03'], rows, 'uganda:amudat'),
        ).toEqual([
            { month: '2026-02', count: 1 },
            { month: '2026-03', count: 3 },
        ]);
    });
});

describe('sumStephensiByDistrict', () => {
    it('adds every label per District', () => {
        expect(sumStephensiByDistrict(rows)).toEqual(
            new Map([
                ['uganda:amudat', 4],
                ['uganda:gulu', 4],
            ]),
        );
    });
});

describe('sumStephensiByDistrict up to a month', () => {
    const rows = [
        {
            programId: 4,
            species: 'Anopheles stephensi',
            specimens: 5,
            latestMonth: '2026-03',
            districts: [
                {
                    key: 'kenya:kilifi',
                    name: 'Kilifi',
                    specimens: 5,
                    monthly: [
                        { month: '2026-01', specimens: 2 },
                        { month: '2026-03', specimens: 3 },
                    ],
                },
                {
                    key: 'kenya:turkana',
                    name: 'Turkana',
                    specimens: 1,
                    monthly: [{ month: '2026-03', specimens: 1 }],
                },
            ],
        },
    ];

    it('adds months up to it and leaves out Districts with none yet', () => {
        expect([...sumStephensiByDistrict(rows, '2026-02')]).toEqual([
            ['kenya:kilifi', 2],
        ]);
    });

    it('uses the whole period without a month', () => {
        expect(sumStephensiByDistrict(rows).get('kenya:kilifi')).toBe(5);
    });
});
