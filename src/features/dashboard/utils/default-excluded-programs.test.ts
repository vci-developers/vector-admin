import { describe, expect, it } from 'vitest';
import { defaultExcludedPrograms } from './default-excluded-programs';

const programs = [
    { programId: 1, country: 'Uganda' },
    { programId: 3, country: 'Ghana' },
    { programId: 4, country: 'Kenya' },
];

describe('defaultExcludedPrograms', () => {
    it('opens a Stakeholder on Uganda only', () => {
        expect(defaultExcludedPrograms('stakeholder', programs)).toEqual([
            3, 4,
        ]);
    });

    it('keeps all of a Stakeholder’s Programs when none is Uganda', () => {
        expect(
            defaultExcludedPrograms('stakeholder', programs.slice(1)),
        ).toEqual([]);
    });

    it('leaves Developers on the Hidden-by-Default list', () => {
        expect(defaultExcludedPrograms('developer', programs)).toEqual([5]);
    });
});
