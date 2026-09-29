import { describe, expect, it } from 'vitest';
import { cycleLabel } from './cycle-label';

describe('cycleLabel', () => {
    it('lists up to three cycles in order', () => {
        expect(cycleLabel([])).toBeNull();
        expect(cycleLabel([5, 4, 4])).toEqual({
            kind: 'list',
            numbers: '4, 5',
            count: 2,
        });
    });

    it('collapses longer runs to their span and count', () => {
        expect(cycleLabel([672, 350, 351, 500])).toEqual({
            kind: 'range',
            first: 350,
            last: 672,
            count: 4,
        });
    });
});
