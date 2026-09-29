import type { SessionState } from '@/api/session/validation/session-schema';

type SessionRow = {
    sessionId: number;
    state: SessionState | null;
    deviceId: number;
    siteId: number;
    siteName: string | null;
    collectionDate: number | null;
    submittedAt: number;
    timeToConfirmation: number | null;
    missing: {
        species: number;
        captureDate: boolean;
        geolocation: boolean;
        operatorId: boolean;
    };
};

export const SORTABLE_COLUMNS = [
    'sessionId',
    'state',
    'deviceId',
    'site',
    'collectionDate',
    'submittedAt',
    'timeToConfirmation',
    'missing',
] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];
/** Null keeps the order the rows came in (uncertified first, oldest first). */
export type SessionSort = {
    column: SortColumn;
    direction: 'asc' | 'desc';
} | null;

export const MISSING_OPTIONS = [
    'species',
    'captureDate',
    'geolocation',
    'operatorId',
    'none',
] as const;
export type MissingOption = (typeof MISSING_OPTIONS)[number];
export type StateOption = SessionState | 'UNKNOWN';

/** Each list holds the values to keep; an empty list keeps everything. */
export type SessionFilters = {
    states: StateOption[];
    deviceIds: number[];
    siteIds: number[];
    missing: MissingOption[];
};

export const NO_FILTERS: SessionFilters = {
    states: [],
    deviceIds: [],
    siteIds: [],
    missing: [],
};

// Workflow order, so sorting by State reads as progress through Review.
const STATE_ORDER: StateOption[] = [
    'NEEDS_REVIEW',
    'IN_REVIEW',
    'CERTIFIED',
    'SUBMITTED',
    'NOT_APPLICABLE',
    'UNKNOWN',
];

export const stateOf = (row: SessionRow): StateOption => row.state ?? 'UNKNOWN';

export function missingOf(row: SessionRow): MissingOption[] {
    const fields = (
        ['captureDate', 'geolocation', 'operatorId'] as const
    ).filter(field => row.missing[field]);
    const all: MissingOption[] =
        row.missing.species > 0 ? ['species', ...fields] : [...fields];
    return all.length > 0 ? all : ['none'];
}

/** Sort value; null always sorts last, whichever the direction. */
function valueOf(row: SessionRow, column: SortColumn): number | string | null {
    switch (column) {
        case 'state':
            return STATE_ORDER.indexOf(stateOf(row));
        case 'site':
            return (row.siteName ?? '').toLocaleLowerCase() || null;
        case 'missing':
            return missingOf(row).filter(m => m !== 'none').length;
        default:
            return row[column];
    }
}

export function filterSessionRows<Row extends SessionRow>(
    rows: Row[],
    filters: SessionFilters,
): Row[] {
    const keep = <T>(selected: T[], value: T) =>
        selected.length === 0 || selected.includes(value);
    return rows.filter(
        row =>
            keep(filters.states, stateOf(row)) &&
            keep(filters.deviceIds, row.deviceId) &&
            keep(filters.siteIds, row.siteId) &&
            (filters.missing.length === 0 ||
                missingOf(row).some(m => filters.missing.includes(m))),
    );
}

export function sortSessionRows<Row extends SessionRow>(
    rows: Row[],
    sort: SessionSort,
): Row[] {
    if (!sort) return rows;
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const x = valueOf(a, sort.column);
        const y = valueOf(b, sort.column);
        if (x === null || y === null) {
            if (x !== y) return x === null ? 1 : -1;
        } else if (x !== y) {
            const order =
                typeof x === 'string' && typeof y === 'string'
                    ? x.localeCompare(y)
                    : Number(x) - Number(y);
            return sign * order;
        }
        return a.sessionId - b.sessionId;
    });
}

/** asc -> desc -> back to the default order. */
export function nextSort(
    current: SessionSort,
    column: SortColumn,
): SessionSort {
    if (current?.column !== column) return { column, direction: 'asc' };
    return current.direction === 'asc' ? { column, direction: 'desc' } : null;
}
