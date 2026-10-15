import { describe, expect, it } from 'vitest';
import { parseDensity } from './density';

describe('parseDensity', () => {
    it('keeps a saved choice', () => {
        expect(parseDensity('compact')).toBe('compact');
    });

    it('falls back to comfortable for a missing or unknown value', () => {
        expect(parseDensity(undefined)).toBe('comfortable');
        expect(parseDensity('tiny')).toBe('comfortable');
    });
});
