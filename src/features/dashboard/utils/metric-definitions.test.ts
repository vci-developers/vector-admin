import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import { buildPeriodMetrics } from './build-period-metrics';
import { METRICS } from './metric-definitions';

const sum = (terms: { value: number }[]) =>
    terms.reduce((total, { value }) => total + value, 0);

// Hand-built counts with ratios worked out the way the BFF does.
const metrics: PeriodMetricsDto = {
    activeDevices: 4,
    images: 1234,
    uniqueSpecimens: 1000,
    records: 1000,
    completeRecords: 456,
    fieldPasses: {
        species: 900,
        captureDate: 1000,
        geolocation: 700,
        operatorId: 1000,
    },
    dhis2Records: 40,
    submittedRecords: 10,
    uniqueUsers: 3,
    logins: 12,
    imagesPerActiveDevice: 1234 / 4,
    metadataCompleteness: 456 / 1000,
    fieldCompleteness: {
        species: 0.9,
        captureDate: 1,
        geolocation: 0.7,
        operatorId: 1,
    },
    dhis2UploadRate: 10 / 40,
    timing: null,
};

describe('METRICS calculations', () => {
    it('reproduce each ratio tile exactly', () => {
        const ratios = METRICS.filter(metric => metric.calculation);
        expect(ratios.map(metric => metric.key)).toEqual([
            'imagesPerActiveDevice',
            'metadataCompleteness',
            'dhis2UploadRate',
        ]);
        for (const metric of ratios) {
            const { numerator, denominator } = metric.calculation!(metrics);
            expect(sum(numerator) / sum(denominator)).toBeCloseTo(
                metric.value(metrics)!,
            );
        }
    });

    it('agree with the BFF when a denominator is 0', () => {
        const empty = buildPeriodMetrics([], { to: '2026-01' }).total;
        for (const metric of METRICS.filter(m => m.calculation)) {
            expect(sum(metric.calculation!(empty).denominator)).toBe(0);
            expect(metric.value(empty)).toBeNull();
        }
    });
});
