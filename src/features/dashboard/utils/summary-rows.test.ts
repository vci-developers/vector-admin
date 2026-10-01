import type {
    LocationNodeDto,
    PeriodMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import {
    buildLocationRows,
    programLocationKey,
    summaryToTsv,
    type SummaryRow,
} from './summary-rows';

const metrics: PeriodMetricsDto = {
    activeDevices: 4,
    images: 1234,
    uniqueSpecimens: 1000,
    records: 1000,
    completeRecords: 456,
    fieldPasses: {
        species: 1000,
        captureDate: 1000,
        geolocation: 456,
        operatorId: 1000,
    },
    certifiedSessions: 0,
    submittedSessions: 0,
    uniqueUsers: 3,
    logins: 12,
    imagesPerActiveDevice: 308.5,
    metadataCompleteness: 0.456,
    fieldCompleteness: {
        species: 1,
        captureDate: 1,
        geolocation: 0.456,
        operatorId: 1,
    },
    dhis2UploadRate: null,
};

const row = (
    name: string,
    rowMetrics: PeriodMetricsDto | null,
): SummaryRow => ({
    programId: 1,
    name,
    country: 'Uganda',
    color: 'var(--series-1)',
    hasCountryBox: true,
    cycles: [],
    metrics: rowMetrics,
});

const labels = {
    header: ['Program', 'A'],
    total: 'Total',
    incomplete: 'Incomplete',
};

describe('summaryToTsv', () => {
    it('writes locale-free values and blanks for undefined ratios', () => {
        const tsv = summaryToTsv(
            [row('Uganda', metrics)],
            { metrics, incomplete: false },
            labels,
        );
        expect(tsv.split('\n')[1]).toBe(
            'Uganda\t4\t1234\t1000\t308.5\t3\t12\t45.6%\t\t100.0%\t100.0%\t45.6%\t100.0%',
        );
    });

    it('blanks a failed Program and never totals a partial selection', () => {
        const tsv = summaryToTsv(
            [row('Uganda', metrics), row('Ghana', null)],
            { metrics, incomplete: true },
            labels,
        );
        const [, , failed, total] = tsv.split('\n');
        expect(failed).toBe(`Ghana${'\t'.repeat(12)}`);
        expect(total).toBe(`Total${'\tIncomplete'.repeat(12)}`);
    });
});

describe('buildLocationRows', () => {
    const place = (
        key: string,
        parentKey: string | null,
        images: number,
    ): LocationNodeDto => ({
        key,
        parentKey,
        programId: 1,
        level: `Level of ${key}`,
        name: key,
        metrics: { ...metrics, images },
    });
    const top = programLocationKey(1);
    const names = (rows: ReturnType<typeof buildLocationRows>, key: string) =>
        rows.get(key)?.map(row => row.places.map(p => p.name).join(' › '));

    it('merges a chain of single children that share every number', () => {
        const rows = buildLocationRows([
            place('district', null, 10),
            place('subCounty', 'district', 10),
            place('parish', 'subCounty', 10),
            place('house1', 'parish', 6),
            place('house2', 'parish', 4),
        ]);

        expect(names(rows, top)).toEqual(['district › subCounty › parish']);
        expect(rows.get(top)?.[0]).toMatchObject({
            key: 'parish',
            hasChildren: true,
        });
        expect(names(rows, 'parish')).toEqual(['house1', 'house2']);
    });

    it('keeps a place with data of its own apart from its only child', () => {
        const rows = buildLocationRows([
            place('region', null, 10),
            place('sentinelSite', 'region', 7),
        ]);

        expect(names(rows, top)).toEqual(['region']);
        expect(names(rows, 'region')).toEqual(['sentinelSite']);
    });

    it('merges down to a leaf, which then has no children', () => {
        const rows = buildLocationRows([
            place('village', null, 3),
            place('house', 'village', 3),
        ]);

        expect(rows.get(top)).toEqual([
            expect.objectContaining({
                key: 'house',
                places: [
                    { name: 'village', level: 'Level of village' },
                    { name: 'house', level: 'Level of house' },
                ],
                hasChildren: false,
            }),
        ]);
    });
});
