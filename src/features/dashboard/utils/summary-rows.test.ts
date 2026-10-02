import type {
    Dashboard,
    PeriodMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import { buildSummaryGroups, summaryToTsv } from './summary-rows';

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
};

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
        expect(lines[1]).toBe('\t'.repeat(16));
    });
});

describe('buildSummaryGroups', () => {
    it('lists each selected Program with its areas, then its total', () => {
        const dashboard: Dashboard = {
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
                previousTotal: null,
            },
            areas: [
                { programId: 1, level: 'District', name: 'Gulu', metrics },
                { programId: 1, level: null, name: null, metrics },
            ],
            devices: [],
            sitePaths: {},
            specimenPoints: { placed: [], unplaced: [] },
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
