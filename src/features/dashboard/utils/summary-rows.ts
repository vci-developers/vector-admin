import type {
    AreaMetricsDto,
    Dashboard,
    PeriodMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import {
    FIELDS,
    METRICS,
    type FieldKey,
    type MetricFormat,
    type MetricKey,
} from './metric-definitions';
import { programSeriesColor } from './series-colors';

export const TIMING_STATS = ['median', 'p25', 'p75', 'mean', 'sd'] as const;
export type TimingStat = (typeof TIMING_STATS)[number];

/** The team sheet's columns, in its order. */
export type SheetColumn = {
    format: MetricFormat;
    value: (metrics: PeriodMetricsDto) => number | null;
} & (
    | { kind: 'metric'; key: MetricKey }
    | { kind: 'field'; key: FieldKey }
    | { kind: 'timing'; key: TimingStat }
);

export const SHEET_COLUMNS: SheetColumn[] = [
    ...METRICS.map(({ key, format, value }): SheetColumn => ({
        kind: 'metric',
        key,
        format,
        value,
    })),
    ...FIELDS.map((key): SheetColumn => ({
        kind: 'field',
        key,
        format: 'percent',
        value: m => m.fieldCompleteness[key],
    })),
    ...TIMING_STATS.map((key): SheetColumn => ({
        kind: 'timing',
        key,
        format: 'decimal',
        value: m => m.timing?.[key] ?? null,
    })),
];

export type SummaryRow = {
    key: string;
    /** An area's name; null for the Program total or Sessions at no place. */
    name: string | null;
    /** null when the Program failed to load. */
    metrics: PeriodMetricsDto | null;
};

export type SummaryGroup = {
    programId: number;
    name: string;
    country: string;
    color: string;
    cycles: number[];
    /** Its areas' level, e.g. "District"; null when no area has one. */
    level: string | null;
    areas: SummaryRow[];
    total: SummaryRow;
};

const areaRow = (area: AreaMetricsDto): SummaryRow => ({
    key: `${area.programId}/${area.name ?? ''}`,
    name: area.name,
    metrics: area.metrics,
});

/** Each selected Program: one row per top-level area, then its total. */
export function buildSummaryGroups(dashboard: Dashboard): SummaryGroup[] {
    const allProgramIds = dashboard.programs.map(p => p.programId);
    const programs = new Map(dashboard.programs.map(p => [p.programId, p]));
    const loaded = new Map(
        dashboard.metrics.programs.map(p => [p.programId, p]),
    );
    const areas = Map.groupBy(dashboard.areas, area => area.programId);

    return dashboard.selectedProgramIds.map(programId => {
        const programAreas = areas.get(programId) ?? [];
        return {
            programId,
            name: programs.get(programId)?.name ?? String(programId),
            country: programs.get(programId)?.country ?? '',
            color: programSeriesColor(programId, allProgramIds),
            cycles: loaded.get(programId)?.cycles ?? [],
            level: programAreas.find(area => area.level)?.level ?? null,
            areas: programAreas.map(areaRow),
            total: {
                key: `${programId}/total`,
                name: null,
                metrics: loaded.get(programId)?.metrics ?? null,
            },
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

/**
 * Values only, one line per row and no header or name, to paste into the
 * team sheet; a row with no metrics (a failed Program) is all blanks.
 */
export function summaryToTsv(rows: (PeriodMetricsDto | null)[]): string {
    return rows
        .map(metrics =>
            SHEET_COLUMNS.map(column =>
                metrics
                    ? formatForSheet(column.value(metrics), column.format)
                    : '',
            ).join('\t'),
        )
        .join('\n');
}
