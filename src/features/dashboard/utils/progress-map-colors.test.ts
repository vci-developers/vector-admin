import { describe, expect, it } from 'vitest';
import { progressScanFillColor } from './progress-map-colors';

describe('progressScanFillColor', () => {
    it('keeps a small count paler on the even scale', () => {
        expect(progressScanFillColor(100, 400, true)).toBe(
            progressScanFillColor(25, 400),
        );
    });

    it('agrees on both scales at nothing and at the maximum', () => {
        expect(progressScanFillColor(0, 400, true)).toBe(
            progressScanFillColor(0, 400),
        );
        expect(progressScanFillColor(400, 400, true)).toBe(
            progressScanFillColor(400, 400),
        );
    });
});
