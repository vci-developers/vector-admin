import type {
    Dashboard,
    PeriodMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import {
    buildSummaryGroups,
    SHEET_COLUMNS,
    summaryToTsv,
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
    dhis2Records: 0,
    submittedRecords: 0,
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
    timing: { count: 3, median: 20, p25: 15, p75: 25.25, mean: 20, sd: null },
    excludedGaps: 2,
};

describe('SHEET_COLUMNS counts', () => {
    it('gives each percentage its numerator and denominator, and counts none', () => {
        const counts = (key: string) =>
            SHEET_COLUMNS.find(column => column.key === key)?.counts?.(metrics);

        expect(counts('metadataCompleteness')).toEqual({
            numerator: 456,
            denominator: 1000,
        });
        expect(counts('geolocation')).toEqual({
            numerator: 456,
            denominator: 1000,
        });
        expect(counts('dhis2UploadRate')).toEqual({
            numerator: 0,
            denominator: 0,
        });
        expect(counts('images')).toBeUndefined();
    });
});

describe('summaryToTsv', () => {
    it('writes values only in sheet order, locale-free, blanks where undefined', () => {
        expect(summaryToTsv([metrics]).split('\t')).toEqual([
            '4',
            '1234',
            '1000',
            '308.5',
            '3',
            '12',
            '45.6%',
            '',
            '100.0%',
            '100.0%',
            '45.6%',
            '100.0%',
            '',
            '2',
            '20.0',
            '15.0',
            '25.3',
            '20.0',
            '',
        ]);
    });

    it('puts each row on its own line and blanks a failed Program', () => {
        const lines = summaryToTsv([
            { ...metrics, uniqueUsers: null, logins: null, timing: null },
            null,
        ]).split('\n');

        expect(lines).toHaveLength(2);
        expect(lines[0].split('\t').slice(4, 6)).toEqual(['', '']);
        expect(lines[1]).toBe('\t'.repeat(18));
    });
});

describe('buildSummaryGroups', () => {
    it('lists each selected Program with its areas, then its total', () => {
        const dashboard: Dashboard = {
            viewer: 'developer',
            programs: [
                { programId: 1, name: 'NMED', country: 'Uganda' },
                { programId: 2, name: 'KEMRI', country: 'Kenya' },
            ],
            selectedProgramIds: [1, 2],
            failedProgramIds: [2],
            metrics: {
                from: '2026-01',
                to: '2026-01',
                programs: [{ programId: 1, metrics, cycles: [5] }],
                total: metrics,
            },
            areas: [
                { programId: 1, level: 'District', name: 'Gulu', metrics },
                { programId: 1, level: null, name: null, metrics },
            ],
            devices: [],
            sitePaths: {},
            specimenPoints: { placed: [], unplaced: [] },
            userCoverage: [],
            projectedDevices: [],
            plannedAreas: [],
            deviceCounts: null,
            areaDevicePlans: [],
            lastUpdatedAt: null,
        };

        const [uganda, kenya] = buildSummaryGroups(dashboard);

        expect(uganda).toMatchObject({
            level: 'District',
            cycles: [5],
            areas: [{ name: 'Gulu' }, { name: null }],
            total: { metrics },
        });
        expect(kenya).toMatchObject({
            level: null,
            areas: [],
            total: { metrics: null },
        });
    });
});
