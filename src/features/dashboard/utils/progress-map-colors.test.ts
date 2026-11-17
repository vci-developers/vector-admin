import { describe, expect, it } from 'vitest';
import {
    progressScanFillColor,
    progressStephensiFillColor,
} from './progress-map-colors';

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

describe('progressStephensiFillColor', () => {
    it('reaches the stephensi colour three quarters of the way up', () => {
        expect(progressStephensiFillColor(9, 16)).toBe('rgb(181 23 111)');
    });

    it('darkens with more specimens', () => {
        expect(progressStephensiFillColor(1, 10)).not.toBe(
            progressStephensiFillColor(10, 10),
        );
        expect(progressStephensiFillColor(10, 10)).toBe('rgb(112 10 68)');
    });
});
