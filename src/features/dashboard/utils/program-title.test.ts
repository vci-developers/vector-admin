import { describe, expect, it } from 'vitest';
import { programTitle } from './program-title';

describe('programTitle', () => {
    it('leads with the country and keeps the Program name', () => {
        expect(
            programTitle({ name: 'KEMRI - AnoSTEP', country: 'Kenya' }),
        ).toBe('Kenya (KEMRI - AnoSTEP)');
    });

    it('falls back to the name when the country is blank', () => {
        expect(programTitle({ name: 'Pilot', country: '' })).toBe('Pilot');
    });
});
