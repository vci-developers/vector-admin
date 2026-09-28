import type {
    Dashboard,
    MonthMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import { FIELDS, METRICS, type MetricFormat } from './metric-definitions';
import { programSeriesColor } from './series-colors';

export type SummaryRow = {
    programId: number;
    name: string;
    color: string;
    hasCountryBox: boolean;
    cycles: number[];
    /** null when the Program failed to load. */
    metrics: MonthMetricsDto | null;
};

export function buildSummaryRows(
    dashboard: Dashboard,
    month: string,
): SummaryRow[] {
    const allProgramIds = dashboard.programs.map(p => p.programId);
    const names = new Map(dashboard.programs.map(p => [p.programId, p.name]));
    const loaded = new Map(
        dashboard.metrics.programs.map(p => [p.programId, p]),
    );

    return dashboard.selectedProgramIds.map(programId => {
        const programMetrics = loaded.get(programId);
        return {
            programId,
            name: names.get(programId) ?? String(programId),
            color: programSeriesColor(programId, allProgramIds),
            hasCountryBox: programMetrics?.hasCountryBox ?? true,
            cycles: programMetrics?.cycleLabels[month] ?? [],
            metrics: programMetrics?.months[month] ?? null,
        };
    });
}

// Plain, locale-free values so Excel parses them in any locale.
function formatForSheet(value: number | null, format: MetricFormat): string {
    if (value === null) return '';
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
    if (format === 'decimal') return value.toFixed(1);
    return String(value);
}

function sheetCells(metrics: MonthMetricsDto): string[] {
    return [
        ...METRICS.map(metric =>
            formatForSheet(metric.value(metrics), metric.format),
        ),
        ...FIELDS.map(field =>
            formatForSheet(metrics.fieldCompleteness[field], 'percent'),
        ),
    ];
}

const COLUMN_COUNT = METRICS.length + FIELDS.length;

export function summaryToTsv(
    rows: SummaryRow[],
    total: { metrics: MonthMetricsDto | null; incomplete: boolean },
    labels: { header: string[]; total: string; incomplete: string },
): string {
    const lines = [
        labels.header,
        ...rows.map(row => [
            row.name,
            ...(row.metrics
                ? sheetCells(row.metrics)
                : Array(COLUMN_COUNT).fill('')),
        ]),
        [
            labels.total,
            ...(total.incomplete || !total.metrics
                ? Array(COLUMN_COUNT).fill(labels.incomplete)
                : sheetCells(total.metrics)),
        ],
    ];
    return lines.map(cells => cells.join('\t')).join('\n');
}
