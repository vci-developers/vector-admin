import type { LoadedCoverage } from '@/api/coverage/load-coverage';
import type { ProgressDashboard } from '@/api/progress/validation/progress-schema';
import type { ProgressDeviceMonth } from './build-progress-device-metrics';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildProgress, type ProgressProgramData } from './build-progress';
import { buildProgressDeviceMetrics } from './build-progress-device-metrics';
import { buildProgressReport } from './build-progress-report';

const GENERATED_AT = Date.UTC(2026, 9, 9, 16);
const progress: ProgressDashboard = {
    programs: [
        { programId: 7, name: 'Uganda reporting', country: 'Uganda' },
        { programId: 9, name: 'Excluded program', country: 'Ghana' },
    ],
    selectedProgramIds: [7],
    failedProgramIds: [],
    from: '2026-08',
    to: '2026-09',
    reportingLocations: 3,
    coverageByProgram: [{ programId: 7, unit: 'household', count: 3 }],
    uniqueScans: 8,
    uniqueSpecimens: 0,
    species: [],
    scansByProgram: [{ programId: 7, scans: 8, specimens: 0 }],
    monthly: [
        { month: '2026-08', uniqueScans: 5 },
        { month: '2026-09', uniqueScans: 3 },
    ],
    lastUpdatedAt: GENERATED_AT - 60_000,
    latestReceivedAt: GENERATED_AT - 120_000,
    districts: [
        {
            key: 'uganda:gulu',
            programId: 7,
            programIds: [7],
            country: 'Uganda',
            name: 'Gulu',
            reportingLocations: 2,
            coverageByProgram: [{ programId: 7, unit: 'household', count: 2 }],
            uniqueScans: 8,
            uniqueSpecimens: 0,
            species: [],
            scansByProgram: [{ programId: 7, scans: 8, specimens: 0 }],
            monthly: [
                { month: '2026-08', uniqueScans: 5 },
                { month: '2026-09', uniqueScans: 3 },
            ],
            position: { latitude: 2.8, longitude: 32.3 },
            latestReceivedAt: GENERATED_AT - 120_000,
        },
        {
            key: 'uganda:lira',
            programId: 7,
            programIds: [7],
            country: 'Uganda',
            name: 'Lira',
            reportingLocations: 1,
            coverageByProgram: [{ programId: 7, unit: 'household', count: 1 }],
            uniqueScans: 0,
            uniqueSpecimens: 0,
            species: [],
            scansByProgram: [{ programId: 7, scans: 0, specimens: 0 }],
            monthly: [
                { month: '2026-08', uniqueScans: 0 },
                { month: '2026-09', uniqueScans: 0 },
            ],
            position: null,
            latestReceivedAt: null,
        },
    ],
};

const planning: LoadedCoverage = {
    source: 'saved',
    savedAt: GENERATED_AT - 86_400_000,
    liveProblem: 'Live planning workbook unavailable',
    figures: {
        units: [
            {
                programId: 7,
                unit: 'Gulu',
                status: 'Active',
                boundary: null,
                region: null,
            },
            {
                programId: 7,
                unit: 'Future district',
                status: 'Targeted',
                boundary: null,
                region: null,
            },
            {
                programId: 9,
                unit: 'Private district',
                status: 'Active',
                boundary: null,
                region: null,
            },
        ],
        expectedUsers: [
            { programId: 7, month: '2026-09', expected: 6 },
            { programId: 9, month: '2026-09', expected: 999 },
        ],
        programPotential: [
            { programId: 7, programPotential: 12 },
            { programId: 9, programPotential: 999 },
        ],
        projectedDevices: [
            { programId: 7, month: '2026-09', projected: 3 },
            { programId: 9, month: '2026-09', projected: 999 },
        ],
    },
};

function rows(sheet: ExcelJS.Worksheet) {
    const values: ExcelJS.CellValue[][] = [];
    sheet.eachRow(row => {
        values.push(
            Array.isArray(row.values)
                ? Array.from(row.values.slice(1), value => value ?? null)
                : [],
        );
    });
    return values;
}

describe('buildProgressReport', () => {
    it('preserves two images on one specimen as two scans throughout the exported workbook', async () => {
        const collectedAt = Date.UTC(2026, 7, 15);
        const data: ProgressProgramData = {
            program: progress.programs[0],
            snapshot: {
                programId: 7,
                sessions: [
                    {
                        sessionId: 1,
                        siteId: 1,
                        deviceId: 20,
                        type: 'SURVEILLANCE',
                        collectionDate: collectedAt,
                        submittedAt: collectedAt + 60_000,
                        latitude: null,
                        longitude: null,
                    },
                ],
                specimens: [
                    { id: 1, sessionId: 1, images: [{ id: 10 }, { id: 11 }] },
                ],
                sites: [
                    {
                        siteId: 1,
                        name: null,
                        district: 'Gulu',
                        locationHierarchy: {},
                    },
                ],
                collectionCycles: [],
                fetchedAt: GENERATED_AT,
            },
        };
        const period = { from: '2026-08', to: '2026-09' };
        const dashboard: ProgressDashboard = {
            ...buildProgress([data], period),
            programs: [data.program],
            selectedProgramIds: [7],
            failedProgramIds: [],
        };
        const metrics = buildProgressDeviceMetrics([data], period);
        const source = buildProgressReport(
            dashboard,
            null,
            GENERATED_AT,
            metrics,
        );
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await source.xlsx.writeBuffer());
        const actuals = rows(workbook.getWorksheet('Monthly actuals')!);

        expect(actuals).toContainEqual(['Scans', 2]);
        expect(actuals).toContainEqual(['Active reporting locations', 1]);
        expect(actuals).toContainEqual(['2026-08', 2]);
        expect(actuals).toContainEqual(['2026-09', 0]);
        expect(actuals).toContainEqual([
            'Scan definition',
            expect.stringMatching(/one image is one scan/i),
        ]);
        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting',
            'Gulu',
            2,
            '1 collection site',
            new Date(collectedAt + 60_000).toISOString(),
        ]);
        expect(actuals).toContainEqual([
            '2026-08',
            'Uganda',
            'Uganda reporting',
            'Gulu',
            2,
        ]);
        expect(rows(workbook.getWorksheet('Internal metrics')!)).toContainEqual(
            ['2026-08', 'Uganda', 'Uganda reporting', 2, 1, 2, 'Complete'],
        );
    });

    it('exports real monthly observations and zero-catch activity separately from targets', async () => {
        const source = buildProgressReport(progress, planning, GENERATED_AT);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await source.xlsx.writeBuffer());

        expect(workbook.worksheets.map(sheet => sheet.name)).toEqual([
            'Monthly actuals',
            'Targets',
            'Internal metrics',
        ]);
        const actuals = rows(workbook.getWorksheet('Monthly actuals')!);
        expect(actuals).toContainEqual(['2026-08', 5]);
        expect(actuals).toContainEqual(['2026-09', 3]);
        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting',
            'Lira',
            0,
            '1 household',
            'Not available',
        ]);
        expect(actuals).toContainEqual([
            '2026-09',
            'Uganda',
            'Uganda reporting',
            'Gulu',
            3,
        ]);
        expect(JSON.stringify(actuals)).not.toContain('Future district');

        const targets = rows(workbook.getWorksheet('Targets')!);
        expect(targets).toContainEqual([
            'Planning source',
            'Saved coverage workbook snapshot',
        ]);
        expect(targets).toContainEqual([
            'Planning snapshot saved (UTC)',
            new Date(planning.savedAt!).toISOString(),
        ]);
        expect(targets).toContainEqual([
            'Uganda',
            'Uganda reporting',
            'Projected devices',
            null,
            '2026-09',
            3,
            'devices',
        ]);
        expect(JSON.stringify(targets)).toContain('Future district');
    });

    it('includes planning rows only for selected accessible programs across every planning sheet', () => {
        const workbook = buildProgressReport(progress, planning, GENERATED_AT);
        const targets = rows(workbook.getWorksheet('Targets')!);
        expect(JSON.stringify(targets)).not.toContain('Private district');
        expect(JSON.stringify(targets)).not.toContain('Excluded program');
        expect(JSON.stringify(targets)).not.toContain('999');
    });

    it('labels unavailable plans without manufacturing targets or changing actuals', () => {
        const workbook = buildProgressReport(progress, null, GENERATED_AT);
        expect(rows(workbook.getWorksheet('Targets')!)).toContainEqual([
            'Planning source',
            'Planning workbook unavailable',
        ]);
        expect(rows(workbook.getWorksheet('Monthly actuals')!)).toContainEqual([
            'Scans',
            8,
        ]);
        expect(rows(workbook.getWorksheet('Targets')!)).not.toContainEqual([
            'Uganda',
            'Uganda reporting',
            'Projected devices',
            null,
            '2026-09',
            0,
            'devices',
        ]);
    });

    it('attributes merged geographical district actuals to all contributing programs', () => {
        const combined: ProgressDashboard = {
            ...progress,
            programs: [
                ...progress.programs,
                {
                    programId: 8,
                    name: 'Second Uganda program',
                    country: 'Uganda',
                },
            ],
            selectedProgramIds: [7, 8],
            scansByProgram: [
                { programId: 7, scans: 5, specimens: 0 },
                { programId: 8, scans: 3, specimens: 0 },
            ],
            coverageByProgram: [
                { programId: 7, unit: 'household', count: 2 },
                { programId: 8, unit: 'household', count: 1 },
            ],
            districts: progress.districts.map(district =>
                district.name === 'Gulu'
                    ? {
                          ...district,
                          programIds: [7, 8],
                          scansByProgram: [
                              { programId: 7, scans: 5, specimens: 0 },
                              { programId: 8, scans: 3, specimens: 0 },
                          ],
                          coverageByProgram: [
                              { programId: 7, unit: 'household', count: 1 },
                              { programId: 8, unit: 'household', count: 1 },
                          ],
                      }
                    : district,
            ),
        };
        const actuals = rows(
            buildProgressReport(combined, null, GENERATED_AT).getWorksheet(
                'Monthly actuals',
            )!,
        );

        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting; Second Uganda program',
            'Gulu',
            8,
            '2 households',
            new Date(progress.districts[0].latestReceivedAt!).toISOString(),
        ]);
        expect(actuals).toContainEqual([
            '2026-09',
            'Uganda',
            'Uganda reporting; Second Uganda program',
            'Gulu',
            3,
        ]);
    });

    it('exports mixed reporting units separately while preserving image scan totals', async () => {
        const mixed: ProgressDashboard = {
            ...progress,
            programs: [
                progress.programs[0],
                { programId: 2, name: 'Data Collection', country: 'Colombia' },
            ],
            selectedProgramIds: [7, 2],
            reportingLocations: null,
            coverageByProgram: [
                { programId: 7, unit: 'household', count: 3 },
                { programId: 2, unit: 'municipality', count: 2 },
            ],
            uniqueScans: 12,
            uniqueSpecimens: 0,
            species: [],
            scansByProgram: [
                { programId: 7, scans: 8, specimens: 0 },
                { programId: 2, scans: 4, specimens: 0 },
            ],
            monthly: [
                { month: '2026-08', uniqueScans: 7 },
                { month: '2026-09', uniqueScans: 5 },
            ],
            districts: [
                ...progress.districts,
                {
                    key: 'colombia:antioquia',
                    programId: 2,
                    programIds: [2],
                    country: 'Colombia',
                    name: 'Antioquia',
                    reportingLocations: 2,
                    coverageByProgram: [
                        { programId: 2, unit: 'municipality', count: 2 },
                    ],
                    uniqueScans: 4,
                    uniqueSpecimens: 0,
                    species: [],
                    scansByProgram: [{ programId: 2, scans: 4, specimens: 0 }],
                    monthly: [
                        { month: '2026-08', uniqueScans: 2 },
                        { month: '2026-09', uniqueScans: 2 },
                    ],
                    position: null,
                    latestReceivedAt: null,
                },
            ],
        };
        const source = buildProgressReport(mixed, null, GENERATED_AT);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await source.xlsx.writeBuffer());
        const actuals = rows(workbook.getWorksheet('Monthly actuals')!);

        expect(actuals).toContainEqual(['Scans', 12]);
        expect(actuals).toContainEqual([
            'Active reporting coverage',
            '3 households · 2 municipalities',
        ]);
        expect(actuals).toContainEqual(['Active reporting locations', 5]);
        expect(actuals).not.toContainEqual(['Active reporting coverage', 5]);
        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting',
            8,
            3,
            'households',
        ]);
        expect(actuals).toContainEqual([
            'Colombia',
            'Data Collection',
            4,
            2,
            'municipalities',
        ]);
        expect(actuals).toContainEqual([
            'Colombia',
            'Data Collection',
            'Antioquia',
            4,
            '2 municipalities',
            'Not available',
        ]);
    });

    it('exports unavailable coverage without turning it into zero or hiding available scans', () => {
        const incomplete: ProgressDashboard = {
            ...progress,
            reportingLocations: null,
            coverageByProgram: [
                { programId: 7, unit: 'household', count: null },
            ],
            districts: progress.districts.map(district => ({
                ...district,
                reportingLocations: null,
                coverageByProgram: [
                    { programId: 7, unit: 'household', count: null },
                ],
            })),
        };
        const actuals = rows(
            buildProgressReport(incomplete, null, GENERATED_AT).getWorksheet(
                'Monthly actuals',
            )!,
        );

        expect(actuals).toContainEqual(['Scans', 8]);
        expect(actuals).toContainEqual([
            'Active reporting coverage',
            'Households unavailable',
        ]);
        expect(actuals).toContainEqual([
            'Active reporting locations',
            'Unavailable',
        ]);
        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting',
            8,
            'Unavailable',
            'households',
        ]);
        expect(actuals).toContainEqual([
            'Uganda',
            'Uganda reporting',
            'Gulu',
            8,
            'Households unavailable',
            new Date(progress.districts[0].latestReceivedAt!).toISOString(),
        ]);
    });

    it('keeps per-device figures on the internal sheet with blank ratios for incomplete identities', () => {
        const internalMetrics: ProgressDeviceMonth[] = [
            {
                programId: 7,
                programName: 'Uganda reporting',
                country: 'Uganda',
                month: '2026-08',
                reportingDevices: 2,
                uniqueScans: 5,
                scansPerReportingDevice: 2.5,
                incomplete: false,
            },
            {
                programId: 7,
                programName: 'Uganda reporting',
                country: 'Uganda',
                month: '2026-09',
                reportingDevices: 1,
                uniqueScans: 3,
                scansPerReportingDevice: null,
                incomplete: true,
            },
            {
                programId: 9,
                programName: 'Excluded program',
                country: 'Ghana',
                month: '2026-09',
                reportingDevices: 9,
                uniqueScans: 999,
                scansPerReportingDevice: 111,
                incomplete: false,
            },
        ];
        const workbook = buildProgressReport(
            progress,
            null,
            GENERATED_AT,
            internalMetrics,
        );
        const internal = rows(workbook.getWorksheet('Internal metrics')!);

        expect(internal).toContainEqual([
            '2026-08',
            'Uganda',
            'Uganda reporting',
            5,
            2,
            2.5,
            'Complete',
        ]);
        expect(internal).toContainEqual([
            '2026-09',
            'Uganda',
            'Uganda reporting',
            3,
            1,
            null,
            'Incomplete device identity',
        ]);
        expect(JSON.stringify(internal)).not.toContain('Excluded program');
        expect(
            JSON.stringify(rows(workbook.getWorksheet('Monthly actuals')!)),
        ).not.toContain('reporting device');
    });
});
