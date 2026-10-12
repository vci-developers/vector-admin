import type { LoadedCoverage } from '@/api/coverage/load-coverage';
import type { ProgressDashboard } from '@/api/progress/validation/progress-schema';
import type { ProgressDeviceMonth } from './build-progress-device-metrics';
import {
    formatProgressLocations,
    progressLocationUnitLabel,
    totalProgressLocations,
} from './format-progress-locations';
import ExcelJS from 'exceljs';

const timestamp = (value: number | null) =>
    value === null ? 'Not available' : new Date(value).toISOString();

function heading(sheet: ExcelJS.Worksheet, values: string[]) {
    const row = sheet.addRow(values);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF168577' },
    };
    row.height = 24;
    row.alignment = { vertical: 'middle', wrapText: true };
    return row.number;
}

function configureSheet(sheet: ExcelJS.Worksheet) {
    sheet.getRow(1).font = {
        size: 16,
        bold: true,
        color: { argb: 'FF145B53' },
    };
    sheet.getRow(1).height = 28;
    for (const column of sheet.columns) column.width = 24;
    sheet.getColumn(2).width = 58;
    sheet.properties.defaultRowHeight = 20;
    sheet.eachRow(row => {
        row.alignment = { ...row.alignment, vertical: 'middle' };
    });
}

/** Observations and rollout plans are deliberately kept on different sheets. */
export function buildProgressReport(
    progress: ProgressDashboard,
    planning: LoadedCoverage | null,
    generatedAt: number,
    internalMetrics: ProgressDeviceMonth[] = [],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VectorCam';
    workbook.created = new Date(generatedAt);
    workbook.modified = new Date(generatedAt);
    const selected = new Set(progress.selectedProgramIds);
    const programs = new Map(
        progress.programs
            .filter(program => selected.has(program.programId))
            .map(program => [program.programId, program]),
    );
    const programNames = (programIds: number[]) =>
        programIds
            .map(
                programId => programs.get(programId)?.name ?? String(programId),
            )
            .join('; ');

    const actuals = workbook.addWorksheet('Monthly actuals');
    actuals.addRows([
        ['VectorCam · Monthly actuals'],
        [
            'Source',
            'VectorCam API · surveillance, calibration and training sessions',
        ],
        ['Reporting period', `${progress.from} to ${progress.to}`],
        [
            'Monthly reporting tab',
            'Monthly actuals · monthly aggregates from the current API snapshot',
        ],
        [
            'Oldest API snapshot retrieved (UTC)',
            timestamp(progress.lastUpdatedAt),
        ],
        ['Export generated (UTC)', timestamp(generatedAt)],
        ['Scans', progress.uniqueScans],
        [
            'Active reporting locations',
            totalProgressLocations(progress.coverageByProgram) ?? 'Unavailable',
        ],
        [
            'Active reporting coverage',
            formatProgressLocations(progress.coverageByProgram, String),
        ],
        [
            'Scan definition',
            'One image is one scan. Multiple images of a specimen count as separate scans.',
        ],
        [
            'Location definition',
            'Locations are counted at each program’s reporting level, shown in Program totals. Repeat visits count once. The Test Site is excluded.',
        ],
        [],
    ]);
    const monthlyHeader = heading(actuals, [
        'Month',
        'Scans · all selected programs',
    ]);
    actuals.addRows(
        progress.monthly.map(month => [month.month, month.uniqueScans]),
    );
    actuals.addRow([]);
    actuals.addRow(['District totals · selected reporting period']);
    heading(actuals, [
        'Country',
        'Contributing programs',
        'District / reporting area',
        'Scans',
        'Active reporting coverage',
        'Latest data received (UTC)',
    ]);
    for (const district of progress.districts) {
        actuals.addRow([
            district.country,
            programNames(district.programIds),
            district.name,
            district.uniqueScans,
            formatProgressLocations(district.coverageByProgram, String),
            timestamp(district.latestReceivedAt),
        ]);
    }
    actuals.addRow([]);
    actuals.addRow(['Program totals · selected reporting period']);
    heading(actuals, [
        'Country',
        'Program',
        'Scans',
        'Active reporting count',
        'Reporting unit',
    ]);
    const coverageByProgram = new Map(
        progress.coverageByProgram.map(row => [row.programId, row]),
    );
    const scansByProgram = new Map(
        progress.scansByProgram.map(row => [row.programId, row.scans]),
    );
    for (const [programId, program] of programs) {
        const coverage = coverageByProgram.get(programId);
        actuals.addRow([
            program.country,
            program.name,
            scansByProgram.get(programId) ?? 'Unavailable',
            coverage?.count ?? 'Unavailable',
            coverage ? progressLocationUnitLabel(coverage.unit) : 'Unavailable',
        ]);
    }
    actuals.addRow([]);
    actuals.addRow(['Monthly district actuals']);
    heading(actuals, [
        'Month',
        'Country',
        'Contributing programs',
        'District / reporting area',
        'Scans',
    ]);
    for (const district of progress.districts) {
        for (const month of district.monthly) {
            actuals.addRow([
                month.month,
                district.country,
                programNames(district.programIds),
                district.name,
                month.uniqueScans,
            ]);
        }
    }
    actuals.views = [{ state: 'frozen', ySplit: monthlyHeader }];

    const targets = workbook.addWorksheet('Targets');
    targets.addRows([
        ['VectorCam · Targets'],
        [
            'Contents',
            'Rollout planning only. Actual reporting data is on Monthly actuals.',
        ],
        [
            'Planning source',
            planning
                ? planning.source === 'live'
                    ? 'Live coverage workbook'
                    : 'Saved coverage workbook snapshot'
                : 'Planning workbook unavailable',
        ],
        [
            'Planning snapshot saved (UTC)',
            planning?.savedAt !== undefined && planning.savedAt !== null
                ? timestamp(planning.savedAt)
                : 'Not supplied',
        ],
        ['Last manual plan update', 'Not supplied by the workbook'],
        ['Export generated (UTC)', timestamp(generatedAt)],
        [
            'Planning periods',
            'Monthly plans retain their own month and may differ from the reporting period.',
        ],
        [
            'Blank figures',
            'No numeric target was supplied; blank cells do not mean zero.',
        ],
        [],
    ]);
    const targetHeader = heading(targets, [
        'Country',
        'Program',
        'Target type',
        'District / area',
        'Planning month',
        'Planned value',
        'Unit / rollout status',
    ]);
    if (planning) {
        const addPlan = (
            programId: number,
            type: string,
            area: string | null,
            month: string | null,
            value: number | null,
            unit: string,
        ) => {
            const program = programs.get(programId);
            if (!program) return;
            targets.addRow([
                program.country,
                program.name,
                type,
                area,
                month,
                value,
                unit,
            ]);
        };
        for (const unit of planning.figures.units) {
            addPlan(
                unit.programId,
                'Geographic rollout',
                unit.unit,
                null,
                null,
                unit.status,
            );
        }
        for (const row of planning.figures.expectedUsers) {
            addPlan(
                row.programId,
                'Expected field users',
                null,
                row.month,
                row.expected,
                'people',
            );
        }
        for (const row of planning.figures.programPotential) {
            addPlan(
                row.programId,
                'Program user target',
                null,
                null,
                row.programPotential,
                'people',
            );
        }
        for (const row of planning.figures.projectedDevices) {
            addPlan(
                row.programId,
                'Projected devices',
                null,
                row.month,
                row.projected,
                'devices',
            );
        }
    }
    targets.views = [{ state: 'frozen', ySplit: targetHeader }];

    const internal = workbook.addWorksheet('Internal metrics');
    internal.addRows([
        ['VectorCam · Internal metrics'],
        [
            'Contents',
            'Operating figures for internal review. These metrics are kept out of the donor dashboard.',
        ],
        [
            'Source',
            'The same VectorCam API snapshot and surveillance scope as Monthly actuals',
        ],
        ['Reporting period', `${progress.from} to ${progress.to}`],
        [
            'Oldest API snapshot retrieved (UTC)',
            timestamp(progress.lastUpdatedAt),
        ],
        ['Export generated (UTC)', timestamp(generatedAt)],
        [
            'Reporting device definition',
            'Known distinct device registrations reporting during the month; registrations may change for the same phone.',
        ],
        [
            'Ratio definition',
            'Scans divided by reporting devices. Blank when device identity is incomplete or no reporting devices are known.',
        ],
        [],
    ]);
    const internalHeader = heading(internal, [
        'Month',
        'Country',
        'Program',
        'Scans',
        'Known reporting devices',
        'Scans per reporting device',
        'Device data completeness',
    ]);
    for (const row of internalMetrics) {
        const program = programs.get(row.programId);
        if (!program || row.month < progress.from || row.month > progress.to)
            continue;
        internal.addRow([
            row.month,
            program.country,
            program.name,
            row.uniqueScans,
            row.reportingDevices,
            row.incomplete ? null : row.scansPerReportingDevice,
            row.incomplete ? 'Incomplete device identity' : 'Complete',
        ]);
    }
    internal.getColumn(6).numFmt = '0.0';
    internal.views = [{ state: 'frozen', ySplit: internalHeader }];
    for (const sheet of workbook.worksheets) configureSheet(sheet);
    return workbook;
}
