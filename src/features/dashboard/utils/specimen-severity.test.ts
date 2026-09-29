import { describe, expect, it } from 'vitest';
import { SEVERITY_STEPS, specimenSeverity } from './specimen-severity';

describe('specimenSeverity', () => {
    it('has no step for a zero-catch Session', () => {
        expect(specimenSeverity(0)).toBeNull();
    });

    it('puts each count in the highest step it reaches', () => {
        expect(
            [1, 4, 5, 19, 20, 49, 50, 900].map(n => specimenSeverity(n)?.min),
        ).toEqual([1, 1, 5, 5, 20, 20, 50, 50]);
        expect(specimenSeverity(50)).toBe(SEVERITY_STEPS.at(-1));
    });
});
