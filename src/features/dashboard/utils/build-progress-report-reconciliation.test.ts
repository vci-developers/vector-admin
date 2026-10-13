import type { ProgressSnapshot } from '@/api/admin/load-progress-snapshot';
import type { ProgressDashboard } from '@/api/progress/validation/progress-schema';
import type { ProgressSession } from '@/api/progress/validation/progress-snapshot-schema';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildProgress, type ProgressProgramData } from './build-progress';
import { buildProgressDeviceMetrics } from './build-progress-device-metrics';
import { buildProgressReport } from './build-progress-report';

const JULY = Date.UTC(2026, 6, 15, 12);
const AUGUST = Date.UTC(2026, 7, 15, 12);
const SEPTEMBER = Date.UTC(2026, 8, 15, 12);
const GENERATED_AT = Date.UTC(2026, 9, 10, 12);

function collection(
    sessionId: number,
    siteId: number,
    submittedAt: number,
    type: ProgressSession['type'] = 'SURVEILLANCE',
): ProgressSession {
    return {
        sessionId,
        siteId,
        submittedAt,
        collectionDate: SEPTEMBER + 86_400_000,
        deviceId: 20,
        type,
        latitude: null,
        longitude: null,
    };
}

function program(
    programId: number,
    country: string,
    snapshot: Partial<ProgressSnapshot>,
): ProgressProgramData {
    return {
        program: { programId, country, name: `${country} reporting` },
        snapshot: {
            programId,
            sites: [],
            sessions: [],
            specimens: [],
            collectionCycles: [],
            fetchedAt: GENERATED_AT - 60_000,
            ...snapshot,
        },
    };
}

const household = (siteId: number, district: string) => ({
    siteId,
    name: null,
    district,
    villageName: 'Collection village',
    houseNumber: `House ${siteId}`,
    locationHierarchy: {},
});

const data: ProgressProgramData[] = [
    program(1, 'Uganda', {
        sites: [
            household(1, 'Gulu'),
            household(2, 'Gulu'),
            household(11, 'Other'),
        ],
        sessions: [
            collection(1, 1, AUGUST),
            collection(2, 1, SEPTEMBER),
            collection(3, 2, SEPTEMBER),
            collection(4, 1, AUGUST, 'CALIBRATION'),
            collection(5, 11, AUGUST),
            collection(6, 1, JULY),
        ],
        specimens: [
            {
                id: 1,
                sessionId: 1,
                images: [{ id: 10 }, { id: 11 }, { id: 10 }],
            },
            { id: 2, sessionId: 1, images: [{ id: 11 }] },
            { id: 3, sessionId: 2, images: [{ id: 12 }, { id: 13 }] },
            { id: 4, sessionId: 3, images: [] },
            { id: 5, sessionId: 4, images: [{ id: 1000 }] },
            { id: 6, sessionId: 5, images: [{ id: 2000 }] },
            { id: 7, sessionId: 6, images: [{ id: 14 }] },
        ],
    }),
    program(2, 'Colombia', {
        sites: [1, 2].map(siteId => ({
            siteId,
            name: null,
            district: 'Antioquia',
            villageName: 'Medellín',
            locationHierarchy: {},
        })),
        sessions: [collection(1, 1, AUGUST), collection(2, 2, SEPTEMBER)],
        specimens: [
            { id: 1, sessionId: 1, images: [{ id: 10 }, { id: 11 }] },
            { id: 2, sessionId: 2, images: [{ id: 12 }] },
        ],
    }),
    program(3, 'Ghana', {
        sites: [household(1, 'Ada East')],
        sessions: [collection(1, 1, AUGUST), collection(2, 1, SEPTEMBER)],
        specimens: [
            { id: 1, sessionId: 1, images: [] },
            { id: 2, sessionId: 2, images: [{ id: 10 }, { id: 11 }] },
        ],
    }),
    program(4, 'Kenya', {
        sites: [household(1, 'Turkana')],
        sessions: [{ ...collection(1, 1, AUGUST), deviceId: null }],
    }),
    program(6, 'Cameroon', {
        sites: [1, 2].map(siteId => ({
            siteId,
            name: null,
            district: null,
            locationHierarchy: {
                Region: 'North',
                'Health District': 'Garoua',
                'Health Centre': `Centre ${siteId}`,
            },
        })),
        sessions: [collection(1, 1, AUGUST), collection(2, 2, SEPTEMBER)],
        specimens: [{ id: 1, sessionId: 1, images: [{ id: 10 }] }],
    }),
];

function table(
    sheet: ExcelJS.Worksheet,
    heading: string,
): ExcelJS.CellValue[][] {
    let start = 0;
    sheet.eachRow(row => {
        if (row.getCell(1).value === heading) start = row.number + 2;
    });
    const rows: ExcelJS.CellValue[][] = [];
    for (let index = start; start > 0 && index <= sheet.rowCount; index++) {
        const row = sheet.getRow(index);
        if (!row.hasValues) break;
        rows.push(
            Array.from(
                (row.values as ExcelJS.CellValue[]).slice(1),
                value => value ?? null,
            ),
        );
    }
    return rows;
}

function summaryValue(sheet: ExcelJS.Worksheet, label: string) {
    let value: ExcelJS.CellValue = null;
    sheet.eachRow(row => {
        if (row.getCell(1).value === label) value = row.getCell(2).value;
    });
    return value;
}

describe('downloaded progress workbook reconciliation', () => {
    it.each([
        {
            label: 'selected period',
            from: '2026-08',
            expectedScans: 10,
            ugandaScans: 4,
        },
        {
            label: 'all time',
            from: undefined,
            expectedScans: 11,
            ugandaScans: 5,
        },
    ])(
        'reconciles five programs for $label after writing and reading the XLSX bytes',
        async ({ from, expectedScans, ugandaScans }) => {
            const range = { from, to: '2026-09' };
            const progress: ProgressDashboard = {
                ...buildProgress(data, range),
                programs: data.map(row => row.program),
                selectedProgramIds: [1, 2, 3, 4, 6],
                failedProgramIds: [],
            };
            const metrics = buildProgressDeviceMetrics(data, {
                from: progress.from,
                to: progress.to,
            });
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(
                await buildProgressReport(
                    progress,
                    null,
                    GENERATED_AT,
                    metrics,
                ).xlsx.writeBuffer(),
            );
            const actuals = workbook.getWorksheet('Monthly actuals')!;

            expect(summaryValue(actuals, 'Scans')).toBe(expectedScans);
            expect(summaryValue(actuals, 'Scans')).toBe(progress.uniqueScans);
            expect(summaryValue(actuals, 'Active reporting locations')).toBe(6);
            expect(summaryValue(actuals, 'Active reporting coverage')).toBe(
                '4 households · 1 municipality · 1 health district',
            );
            const programTotals = table(
                actuals,
                'Program totals · selected reporting period',
            );
            expect(programTotals).toEqual([
                ['Uganda', 'Uganda reporting', ugandaScans, 2, 'households'],
                ['Colombia', 'Colombia reporting', 3, 1, 'municipalities'],
                ['Ghana', 'Ghana reporting', 2, 1, 'households'],
                ['Kenya', 'Kenya reporting', 0, 1, 'households'],
                ['Cameroon', 'Cameroon reporting', 1, 1, 'health districts'],
            ]);
            expect(
                programTotals.reduce((sum, row) => sum + Number(row[2]), 0),
            ).toBe(expectedScans);
            expect(
                programTotals.reduce((sum, row) => sum + Number(row[3]), 0),
            ).toBe(6);

            const monthlyHeader = actuals
                .getRows(1, actuals.rowCount)!
                .find(
                    row =>
                        row.getCell(2).value ===
                        'Scans · all selected programs',
                )!;
            expect(
                progress.monthly.map(
                    (row, index) =>
                        actuals
                            .getRow(monthlyHeader.number + 1 + index)
                            .getCell(2).value,
                ),
            ).toEqual(from ? [5, 5] : [1, 5, 5]);
            const districtTotals = table(
                actuals,
                'District totals · selected reporting period',
            );
            expect(
                districtTotals.reduce((sum, row) => sum + Number(row[3]), 0),
            ).toBe(expectedScans);
            expect(districtTotals.filter(row => row[0] === 'Cameroon')).toEqual(
                [
                    [
                        'Cameroon',
                        'Cameroon reporting',
                        'Garoua',
                        1,
                        '1 health district',
                        new Date(SEPTEMBER).toISOString(),
                    ],
                ],
            );
            const districtMonths = table(actuals, 'Monthly district actuals');
            expect(
                districtMonths.reduce((sum, row) => sum + Number(row[4]), 0),
            ).toBe(expectedScans);
            expect(districtTotals.some(row => row[2] === 'Other')).toBe(false);

            const internal = workbook.getWorksheet('Internal metrics')!;
            const internalHeader = internal
                .getRows(1, internal.rowCount)!
                .find(row => row.getCell(4).value === 'Scans')!;
            const internalScans = internal
                .getRows(
                    internalHeader.number + 1,
                    internal.rowCount - internalHeader.number,
                )!
                .reduce((sum, row) => sum + Number(row.getCell(4).value), 0);
            expect(internalScans).toBe(expectedScans);
            for (const month of progress.monthly) {
                expect(
                    districtMonths
                        .filter(row => row[0] === month.month)
                        .reduce((sum, row) => sum + Number(row[4]), 0),
                ).toBe(month.uniqueScans);
                expect(
                    internal
                        .getRows(
                            internalHeader.number + 1,
                            internal.rowCount - internalHeader.number,
                        )!
                        .filter(row => row.getCell(1).value === month.month)
                        .reduce(
                            (sum, row) => sum + Number(row.getCell(4).value),
                            0,
                        ),
                ).toBe(month.uniqueScans);
            }
            const incomplete = internal
                .getRows(
                    internalHeader.number + 1,
                    internal.rowCount - internalHeader.number,
                )!
                .find(
                    row =>
                        row.getCell(2).value === 'Kenya' &&
                        row.getCell(1).value === '2026-08',
                )!;
            expect(incomplete.getCell(4).value).toBe(0);
            expect(incomplete.getCell(6).value).toBeNull();
        },
    );
});
