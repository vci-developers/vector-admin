import type { SessionState } from '@/api/session/validation/session-schema';
import { timingStats } from './build-handling-time';

type SessionRow = {
    sessionId: number;
    state: SessionState | null;
    deviceId: number;
    siteId: number;
    siteName: string | null;
    location: { level: string; name: string }[];
    collectorName: string;
    createdAt: number | null;
    collectionDate: number | null;
    handling: {
        images: number;
        gaps: number[];
    };
    submittedAt: number;
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
    'collectorName',
    'createdAt',
    'collectionDate',
    'submittedAt',
    'timeBetweenImages',
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

/**
 * Each list holds the values to keep; an empty list keeps everything. Places
 * are keys from buildPlaceOptions; a place keeps every Site beneath it.
 */
export type SessionFilters = {
    states: StateOption[];
    deviceIds: number[];
    places: string[];
    missing: MissingOption[];
    /** Words that must each appear in the Session, device, Site, collector or place. */
    search: string;
};

export const NO_FILTERS: SessionFilters = {
    states: [],
    deviceIds: [],
    places: [],
    missing: [],
    search: '',
};

/** One place, or a Site, in the Site filter's tree. */
export type PlaceOption = {
    key: string;
    parentKey: string | null;
    /** e.g. "District"; null for the Site itself. */
    level: string | null;
    name: string;
    siteId: number | null;
    /** Sessions at or below it. */
    count: number;
};

/** The row's places broadest first, then its Site, each keyed by its path. */
function placePath(row: SessionRow): Omit<PlaceOption, 'count'>[] {
    const places: Omit<PlaceOption, 'count'>[] = [];
    let parentKey: string | null = null;
    for (const { level, name } of row.location) {
        const key: string = `${parentKey ?? ''}/${encodeURIComponent(level)}=${encodeURIComponent(name)}`;
        places.push({ key, parentKey, level, name, siteId: null });
        parentKey = key;
    }
    places.push({
        key: `${parentKey ?? ''}/#${row.siteId}`,
        parentKey,
        level: null,
        name: row.siteName ?? '',
        siteId: row.siteId,
    });
    return places;
}

/**
 * The Site hierarchy of the given Sessions as a tree (District › … › Site, or
 * Region › … › Site), each place with its Session count. Siblings run from
 * most Sessions to fewest. Sites always end a branch, so two Sites in one
 * village can still be told apart.
 */
export function buildPlaceOptions(rows: SessionRow[]): PlaceOption[] {
    const options = new Map<string, PlaceOption>();
    for (const row of rows) {
        for (const place of placePath(row)) {
            const option = options.get(place.key);
            if (option) option.count += 1;
            else options.set(place.key, { ...place, count: 1 });
        }
    }
    return [...options.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
}

function matchesSearch(row: SessionRow, search: string): boolean {
    const words = search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const text = [
        row.sessionId,
        row.deviceId,
        `#${row.siteId}`,
        row.siteName ?? '',
        row.collectorName,
        ...row.location.map(place => place.name),
    ]
        .join(' ')
        .toLocaleLowerCase();
    return words.every(word => text.includes(word));
}

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

/** The Session's median seconds from one image to the next, if any. */
export const medianGap = (row: SessionRow): number | null =>
    timingStats(row.handling.gaps)?.median ?? null;

/** Sort value; null always sorts last, whichever the direction. */
function valueOf(row: SessionRow, column: SortColumn): number | string | null {
    switch (column) {
        case 'state':
            return STATE_ORDER.indexOf(stateOf(row));
        case 'site':
            return (row.siteName ?? '').toLocaleLowerCase() || null;
        case 'collectorName':
            return row.collectorName.toLocaleLowerCase() || null;
        case 'missing':
            return missingOf(row).filter(m => m !== 'none').length;
        case 'timeBetweenImages':
            return medianGap(row);
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
            (filters.places.length === 0 ||
                placePath(row).some(place =>
                    filters.places.includes(place.key),
                )) &&
            matchesSearch(row, filters.search) &&
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
