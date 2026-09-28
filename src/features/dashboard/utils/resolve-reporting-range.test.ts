import { describe, expect, it } from 'vitest';
import { resolveReportingRange } from './resolve-reporting-range';

const noCustom = { from: null, to: null };
const march2026 = new Date(2026, 2, 15);

describe('resolveReportingRange', () => {
    it('defaults to the last complete month', () => {
        expect(
            resolveReportingRange('last-month', noCustom, march2026),
        ).toEqual({
            from: '2026-02',
            to: '2026-02',
        });
    });

    it('counts relative presets back from the current month', () => {
        expect(resolveReportingRange('3m', noCustom, march2026)).toEqual({
            from: '2026-01',
            to: '2026-03',
        });
        expect(resolveReportingRange('12m', noCustom, march2026)).toEqual({
            from: '2025-04',
            to: '2026-03',
        });
        expect(resolveReportingRange('ytd', noCustom, march2026)).toEqual({
            from: '2026-01',
            to: '2026-03',
        });
    });

    it('moves a bookmarked preset with the calendar', () => {
        expect(
            resolveReportingRange('3m', noCustom, new Date(2026, 5, 1)),
        ).toEqual({
            from: '2026-04',
            to: '2026-06',
        });
    });

    it('leaves the start open for All time', () => {
        expect(resolveReportingRange('all', noCustom, march2026)).toEqual({
            to: '2026-03',
        });
    });

    it('uses a valid custom range and falls back to last month otherwise', () => {
        expect(
            resolveReportingRange(
                'custom',
                { from: '2026-01', to: '2026-06' },
                march2026,
            ),
        ).toEqual({ from: '2026-01', to: '2026-06' });
        expect(
            resolveReportingRange(
                'custom',
                { from: '2026-06', to: '2026-01' },
                march2026,
            ),
        ).toEqual({ from: '2026-02', to: '2026-02' });
        expect(
            resolveReportingRange(
                'custom',
                { from: '2026-13', to: '2026-01' },
                march2026,
            ),
        ).toEqual({ from: '2026-02', to: '2026-02' });
    });
});
