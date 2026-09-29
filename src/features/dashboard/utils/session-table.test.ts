import { describe, expect, it } from 'vitest';
import {
    filterSessionRows,
    NO_FILTERS,
    nextSort,
    sortSessionRows,
} from './session-table';

type Row = Parameters<typeof sortSessionRows>[0][number];

const row = (sessionId: number, overrides: Partial<Row> = {}): Row => ({
    sessionId,
    state: 'NEEDS_REVIEW',
    deviceId: 1,
    siteId: 1,
    siteName: 'Bukatube',
    collectionDate: 1000,
    submittedAt: 2000,
    timeToConfirmation: null,
    missing: {
        species: 0,
        captureDate: false,
        geolocation: false,
        operatorId: false,
    },
    ...overrides,
});

const ids = (rows: Row[]) => rows.map(r => r.sessionId);

describe('sortSessionRows', () => {
    const rows = [
        row(1, { state: 'SUBMITTED', timeToConfirmation: 50 }),
        row(2, { state: 'NEEDS_REVIEW', collectionDate: null }),
        row(3, { state: 'CERTIFIED', timeToConfirmation: 10 }),
        row(4, { state: null, collectionDate: 500 }),
    ];

    it('keeps the incoming order without a sort', () => {
        expect(ids(sortSessionRows(rows, null))).toEqual([1, 2, 3, 4]);
    });

    it('sorts State in workflow order, unknown last', () => {
        expect(
            ids(sortSessionRows(rows, { column: 'state', direction: 'asc' })),
        ).toEqual([2, 3, 1, 4]);
    });

    it('keeps empty values last in both directions', () => {
        const sort = (direction: 'asc' | 'desc') =>
            ids(
                sortSessionRows(rows, {
                    column: 'timeToConfirmation',
                    direction,
                }),
            );
        expect(sort('asc')).toEqual([3, 1, 2, 4]);
        expect(sort('desc')).toEqual([1, 3, 2, 4]);
        expect(
            ids(
                sortSessionRows(rows, {
                    column: 'collectionDate',
                    direction: 'desc',
                }),
            ),
        ).toEqual([1, 3, 4, 2]);
    });

    it('sorts by how many fields are missing', () => {
        const withMissing = [
            row(1),
            row(2, {
                missing: {
                    species: 3,
                    captureDate: true,
                    geolocation: false,
                    operatorId: false,
                },
            }),
            row(3, {
                missing: {
                    species: 0,
                    captureDate: false,
                    geolocation: true,
                    operatorId: false,
                },
            }),
        ];
        expect(
            ids(
                sortSessionRows(withMissing, {
                    column: 'missing',
                    direction: 'desc',
                }),
            ),
        ).toEqual([2, 3, 1]);
    });
});

describe('filterSessionRows', () => {
    const rows = [
        row(1, { state: 'CERTIFIED', deviceId: 7 }),
        row(2, { state: 'IN_REVIEW', siteId: 9 }),
        row(3, {
            state: 'IN_REVIEW',
            missing: {
                species: 0,
                captureDate: false,
                geolocation: true,
                operatorId: false,
            },
        }),
    ];

    it('keeps everything with no filters', () => {
        expect(ids(filterSessionRows(rows, NO_FILTERS))).toEqual([1, 2, 3]);
    });

    it('combines filters across columns', () => {
        expect(
            ids(
                filterSessionRows(rows, {
                    ...NO_FILTERS,
                    states: ['IN_REVIEW'],
                    siteIds: [1],
                }),
            ),
        ).toEqual([3]);
    });

    it('matches Sessions missing any chosen field, or nothing', () => {
        expect(
            ids(
                filterSessionRows(rows, {
                    ...NO_FILTERS,
                    missing: ['geolocation'],
                }),
            ),
        ).toEqual([3]);
        expect(
            ids(filterSessionRows(rows, { ...NO_FILTERS, missing: ['none'] })),
        ).toEqual([1, 2]);
    });
});

describe('nextSort', () => {
    it('cycles ascending, descending, then off', () => {
        const asc = nextSort(null, 'site');
        const desc = nextSort(asc, 'site');
        expect([asc, desc, nextSort(desc, 'site')]).toEqual([
            { column: 'site', direction: 'asc' },
            { column: 'site', direction: 'desc' },
            null,
        ]);
        expect(nextSort(desc, 'deviceId')).toEqual({
            column: 'deviceId',
            direction: 'asc',
        });
    });
});
