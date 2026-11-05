import type { Program } from '@/api/program/validation/program-schema';
import { describe, expect, it } from 'vitest';
import { groupRowsByCountry } from './group-rows-by-country';

const programs = new Map<number, Program>([
    [1, { programId: 1, name: 'Uganda A', country: 'Uganda' }],
    [3, { programId: 3, name: 'Ghana', country: 'Ghana' }],
    [7, { programId: 7, name: 'Uganda B', country: 'Uganda' }],
]);

describe('groupRowsByCountry', () => {
    it('nests a country’s Programs together, in first-seen order', () => {
        expect(
            groupRowsByCountry(
                [{ programId: 1 }, { programId: 3 }, { programId: 7 }],
                programs,
            ),
        ).toEqual([
            { country: 'Uganda', rows: [{ programId: 1 }, { programId: 7 }] },
            { country: 'Ghana', rows: [{ programId: 3 }] },
        ]);
    });

    it('keeps unknown Programs apart rather than pooling them', () => {
        expect(
            groupRowsByCountry([{ programId: 8 }, { programId: 9 }], programs),
        ).toEqual([
            { country: null, rows: [{ programId: 8 }] },
            { country: null, rows: [{ programId: 9 }] },
        ]);
    });
});
