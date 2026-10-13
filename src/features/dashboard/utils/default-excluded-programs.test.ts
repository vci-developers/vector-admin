import { describe, expect, it } from 'vitest';
import { defaultExcludedPrograms } from './default-excluded-programs';

describe('defaultExcludedPrograms', () => {
    it('opens a Stakeholder on every Program', () => {
        expect(defaultExcludedPrograms('stakeholder')).toEqual([]);
    });

    it('leaves Developers on the Hidden-by-Default list', () => {
        expect(defaultExcludedPrograms('developer')).toEqual([5]);
    });
});
