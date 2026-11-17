import { describe, expect, it } from 'vitest';
import { focusedAxisMax, niceCeiling } from './focused-axis-max';

describe('niceCeiling', () => {
    it('rounds up to 1, 2, 2.5 or 5 times a power of ten', () => {
        expect(niceCeiling(0.8)).toBe(1);
        expect(niceCeiling(130)).toBe(200);
        expect(niceCeiling(2100)).toBe(2500);
        expect(niceCeiling(4000)).toBe(5000);
        expect(niceCeiling(5001)).toBe(10000);
        expect(niceCeiling(0)).toBe(0);
    });
});

describe('focusedAxisMax', () => {
    it("tops the axis at the species' busiest month, in specimens", () => {
        const months: { specimens?: Record<string, number> }[] = [
            { specimens: { Culex: 49, Aedes: 300 } },
            { specimens: { Culex: 70 } },
            {},
        ];
        expect(focusedAxisMax(months, 'Culex')).toBe(100);
    });

    it('is null for a species with no specimens', () => {
        expect(
            focusedAxisMax([{ specimens: { Aedes: 3 } }], 'Culex'),
        ).toBeNull();
    });
});
