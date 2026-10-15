import type { ProgressLocationCoverage } from '@/api/progress/validation/progress-schema';
import { describe, expect, it } from 'vitest';
import {
    formatProgressLocations,
    formatSentinelSites,
    groupProgressLocationsByUnit,
    progressLocationUnitLabel,
    totalSentinelSites,
} from './format-progress-locations';

const format = (count: number) => new Intl.NumberFormat('en').format(count);
const coverage = (
    programId: number,
    unit: ProgressLocationCoverage['unit'],
    count: number | null,
): ProgressLocationCoverage => ({ programId, unit, count });

describe('formatProgressLocations', () => {
    it('combines the same reporting unit across programs', () => {
        expect(
            formatProgressLocations(
                [coverage(1, 'household', 1000), coverage(3, 'household', 2)],
                format,
            ),
        ).toBe('1,002 households');
    });

    it('keeps different reporting units separate instead of summing them', () => {
        expect(
            formatProgressLocations(
                [coverage(1, 'household', 2), coverage(17, 'community', 3)],
                format,
            ),
        ).toBe('2 households · 3 communities');
    });

    it('keeps Colombia municipalities distinct from household coverage', () => {
        expect(
            formatProgressLocations(
                [coverage(1, 'household', 12), coverage(2, 'municipality', 3)],
                format,
            ),
        ).toBe('12 households · 3 municipalities');
        expect(
            formatProgressLocations([coverage(2, 'municipality', 1)], format),
        ).toBe('1 municipality');
        expect(
            formatProgressLocations(
                [coverage(2, 'municipality', null)],
                format,
            ),
        ).toBe('Municipalities unavailable');
    });

    it('uses singular labels and retains real zero counts', () => {
        expect(
            formatProgressLocations(
                [
                    coverage(6, 'health-district', 1),
                    coverage(8, 'collection-site', 0),
                ],
                format,
            ),
        ).toBe('1 health district · 0 collection sites');
    });

    it('does not turn incomplete coverage into a known subtotal or zero', () => {
        expect(
            formatProgressLocations(
                [
                    coverage(1, 'household', 12),
                    coverage(3, 'household', null),
                    coverage(17, 'community', 3),
                ],
                format,
            ),
        ).toBe('Households unavailable · 3 communities');
    });

    it('distinguishes no coverage from zero reporting activity', () => {
        expect(formatProgressLocations([], format)).toBe(
            'Reporting coverage unavailable',
        );
        expect(
            formatProgressLocations([coverage(1, 'household', 0)], format),
        ).toBe('0 households');
    });

    it('leaves the supplied coverage untouched', () => {
        const input = Object.freeze([
            Object.freeze(coverage(1, 'household', 2)),
            Object.freeze(coverage(3, 'household', 3)),
        ]);
        expect(groupProgressLocationsByUnit(input)).toEqual([
            { unit: 'household', count: 5 },
        ]);
        expect(input.map(entry => entry.count)).toEqual([2, 3]);
    });
});

describe('progressLocationUnitLabel', () => {
    it.each([
        ['household', 'household', 'households'],
        ['municipality', 'municipality', 'municipalities'],
        ['community', 'community', 'communities'],
        ['health-district', 'health district', 'health districts'],
        ['collection-site', 'collection site', 'collection sites'],
    ] as const)('labels %s precisely', (unit, singular, plural) => {
        expect(progressLocationUnitLabel(unit, 1)).toBe(singular);
        expect(progressLocationUnitLabel(unit, 0)).toBe(plural);
        expect(progressLocationUnitLabel(unit, null)).toBe(plural);
    });
});

describe('totalSentinelSites', () => {
    it('adds Programs and is unknown when one failed to load', () => {
        expect(
            totalSentinelSites([
                { programId: 1, count: 9 },
                { programId: 4, count: 3 },
            ]),
        ).toBe(12);
        expect(
            totalSentinelSites([
                { programId: 1, count: 9 },
                { programId: 4, count: null },
            ]),
        ).toBeNull();
    });
});

describe('formatSentinelSites', () => {
    it('reads one or many', () => {
        expect(formatSentinelSites(1, format)).toBe('1 sentinel site');
        expect(formatSentinelSites(1200, format)).toBe('1,200 sentinel sites');
    });
});
