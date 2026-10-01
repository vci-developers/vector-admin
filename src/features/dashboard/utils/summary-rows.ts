import type {
    Dashboard,
    LocationNodeDto,
    PeriodMetricsDto,
} from '@/api/dashboard/validation/dashboard-schema';
import { FIELDS, METRICS, type MetricFormat } from './metric-definitions';
import { programSeriesColor } from './series-colors';

export type SummaryRow = {
    programId: number;
    name: string;
    country: string;
    color: string;
    hasCountryBox: boolean;
    cycles: number[];
    /** null when the Program failed to load. */
    metrics: PeriodMetricsDto | null;
};

export function buildSummaryRows(dashboard: Dashboard): SummaryRow[] {
    const allProgramIds = dashboard.programs.map(p => p.programId);
    const programs = new Map(dashboard.programs.map(p => [p.programId, p]));
    const loaded = new Map(
        dashboard.metrics.programs.map(p => [p.programId, p]),
    );

    return dashboard.selectedProgramIds.map(programId => {
        const programMetrics = loaded.get(programId);
        return {
            programId,
            name: programs.get(programId)?.name ?? String(programId),
            country: programs.get(programId)?.country ?? '',
            color: programSeriesColor(programId, allProgramIds),
            hasCountryBox: programMetrics?.hasCountryBox ?? true,
            cycles: programMetrics?.cycles ?? [],
            metrics: programMetrics?.metrics ?? null,
        };
    });
}

export const programLocationKey = (programId: number) => `program:${programId}`;

export type LocationPlace = Pick<LocationNodeDto, 'name' | 'level'>;

/**
 * One summary row for a place, or for a chain of places merged into it. `key`
 * is the deepest place's, so its children are listed under that key.
 */
export type LocationRow = {
    key: string;
    /** Broadest first; more than one when single-child places merged. */
    places: LocationPlace[];
    metrics: PeriodMetricsDto;
    hasChildren: boolean;
};

function groupLocationChildren(
    locations: LocationNodeDto[],
): Map<string, LocationNodeDto[]> {
    const children = new Map<string, LocationNodeDto[]>();
    for (const node of locations) {
        const parent = node.parentKey ?? programLocationKey(node.programId);
        const list = children.get(parent);
        if (list) list.push(node);
        else children.set(parent, [node]);
    }
    return children;
}

// Zod builds every metrics object with the same key order.
const sameMetrics = (a: PeriodMetricsDto, b: PeriodMetricsDto) =>
    JSON.stringify(a) === JSON.stringify(b);

/**
 * Rows under each parent key (a place's, or programLocationKey for a
 * Program's top level). A place whose only child holds all of its data merges
 * with that child into one row, as file trees compact single-child folders,
 * so the same numbers are not repeated level after level. A place with data
 * of its own (Sessions at its own Site) never merges.
 */
export function buildLocationRows(
    locations: LocationNodeDto[],
): Map<string, LocationRow[]> {
    const children = groupLocationChildren(locations);
    const rows = new Map<string, LocationRow[]>();

    for (const [parentKey, nodes] of children) {
        rows.set(
            parentKey,
            nodes.map(node => {
                const places: LocationPlace[] = [node];
                let deepest = node;
                let next = children.get(deepest.key);
                while (
                    next?.length === 1 &&
                    sameMetrics(next[0].metrics, deepest.metrics)
                ) {
                    deepest = next[0];
                    places.push(deepest);
                    next = children.get(deepest.key);
                }
                return {
                    key: deepest.key,
                    places: places.map(({ name, level }) => ({ name, level })),
                    metrics: node.metrics,
                    hasChildren: children.has(deepest.key),
                };
            }),
        );
    }
    return rows;
}

// Plain, locale-free values so Excel parses them in any locale.
function formatForSheet(value: number | null, format: MetricFormat): string {
    if (value === null) return '';
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
    if (format === 'decimal') return value.toFixed(1);
    return String(value);
}

function sheetCells(metrics: PeriodMetricsDto): string[] {
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
    total: { metrics: PeriodMetricsDto | null; incomplete: boolean },
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
