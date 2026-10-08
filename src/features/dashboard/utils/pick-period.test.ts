import { describe, expect, it } from 'vitest';
import { pickMonths, shiftPeriod, spanFilters } from './pick-period';

describe('pickMonths', () => {
    it('picks the month alone with no anchor', () => {
        expect(pickMonths(null, '2026-03')).toEqual({
            from: '2026-03',
            to: '2026-03',
        });
    });

    it('spans from the anchor, whichever end was clicked first', () => {
        expect(pickMonths('2026-03', '2026-06')).toEqual({
            from: '2026-03',
            to: '2026-06',
        });
        expect(pickMonths('2026-06', '2025-11')).toEqual({
            from: '2025-11',
            to: '2026-06',
        });
    });
});

describe('shiftPeriod', () => {
    it('steps by the period’s own length, across years', () => {
        expect(
            shiftPeriod({ from: '2026-01', to: '2026-01' }, -1, '2026-10'),
        ).toEqual({ from: '2025-12', to: '2025-12' });
        expect(
            shiftPeriod({ from: '2026-04', to: '2026-06' }, 1, '2026-10'),
        ).toEqual({ from: '2026-07', to: '2026-09' });
    });

    it('never steps past the latest month', () => {
        expect(
            shiftPeriod({ from: '2026-08', to: '2026-09' }, 1, '2026-10'),
        ).toBeNull();
        expect(
            shiftPeriod({ from: '2026-09', to: '2026-09' }, 1, '2026-10'),
        ).toEqual({ from: '2026-10', to: '2026-10' });
    });
});

describe('spanFilters', () => {
    it('stores one month as Month and longer spans as Custom', () => {
        expect(spanFilters({ from: '2026-09', to: '2026-09' })).toEqual({
            range: 'month',
            from: null,
            to: '2026-09',
        });
        expect(spanFilters({ from: '2026-07', to: '2026-09' })).toEqual({
            range: 'custom',
            from: '2026-07',
            to: '2026-09',
        });
    });
});
