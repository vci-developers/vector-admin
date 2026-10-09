import { describe, expect, it } from 'vitest';
import { programCode, programTitle, scopeTitle } from './program-title';

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

describe('scopeTitle', () => {
    it('names a single Program by its country', () => {
        expect(scopeTitle([{ name: 'NMCD', country: 'Uganda' }])).toBe(
            'Uganda',
        );
    });

    it('lists each country once, alphabetically', () => {
        expect(
            scopeTitle([
                { name: 'NMCD', country: 'Uganda' },
                { name: 'KEMRI - AnoSTEP', country: 'Kenya' },
                { name: 'Gulu pilot', country: 'Uganda' },
            ]),
        ).toBe('Kenya, Uganda');
    });

    it('falls back to the name when the country is blank', () => {
        expect(scopeTitle([{ name: 'Pilot', country: '' }])).toBe('Pilot');
    });
});

describe('programCode', () => {
    it('gives the country code, else the country or name', () => {
        expect(programCode({ name: 'UNMED', country: 'Uganda' })).toBe('UG');
        expect(programCode({ name: 'JHU', country: 'Peru' })).toBe('Peru');
        expect(programCode({ name: 'Mind the Gap', country: '' })).toBe(
            'Mind the Gap',
        );
    });
});
