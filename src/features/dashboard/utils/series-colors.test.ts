import { describe, expect, it } from 'vitest';
import { programSeriesColor } from './series-colors';

describe('programSeriesColor', () => {
    it('keeps a Program on the same color whatever order ids arrive in', () => {
        expect(programSeriesColor(9, [14, 9, 7])).toBe('var(--series-2)');
        expect(programSeriesColor(9, [7, 9, 14])).toBe('var(--series-2)');
    });

    it('gives Programs past the eighth a neutral color', () => {
        const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        expect(programSeriesColor(8, ids)).toBe('var(--series-8)');
        expect(programSeriesColor(9, ids)).toBe('var(--series-other)');
    });
});
