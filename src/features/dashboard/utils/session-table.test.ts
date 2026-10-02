import { describe, expect, it } from 'vitest';
import {
    buildPlaceOptions,
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
    location: [
        { level: 'District', name: 'Buyende' },
        { level: 'Village', name: 'Bukatube' },
    ],
    collectorName: 'Okello James',
    createdAt: 1000,
    handling: { images: 0, gaps: [] },
    collectionDate: 1000,
    submittedAt: 2000,
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
        row(1, { state: 'SUBMITTED', createdAt: 50 }),
        row(2, {
            state: 'NEEDS_REVIEW',
            collectionDate: null,
            createdAt: null,
        }),
        row(3, { state: 'CERTIFIED', createdAt: 10 }),
        row(4, { state: null, collectionDate: 500, createdAt: null }),
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
                    column: 'createdAt',
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
                    places: ['/District=Buyende/Village=Bukatube/#1'],
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

describe('Site hierarchy filter', () => {
    const gulu = [{ level: 'District', name: 'Gulu' }];
    const rows = [
        row(1),
        row(2, { siteId: 2, siteName: 'Bukatube East' }),
        row(3, { siteId: 3, siteName: 'Gulu HC', location: gulu }),
        row(4, { siteId: 4, siteName: null, location: [] }),
    ];
    const options = buildPlaceOptions(rows);
    const keyOf = (name: string) =>
        options.find(option => option.name === name)!.key;

    it('nests places broadest first with their Session counts', () => {
        type Tree = [string, string | null, number, Tree[]];
        const tree = (parentKey: string | null): Tree[] =>
            options
                .filter(option => option.parentKey === parentKey)
                .map(({ key, name, level, count }) => [
                    name,
                    level,
                    count,
                    tree(key),
                ]);
        expect(tree(null)).toEqual([
            [
                'Buyende',
                'District',
                2,
                [
                    [
                        'Bukatube',
                        'Village',
                        2,
                        [
                            ['Bukatube', null, 1, []],
                            ['Bukatube East', null, 1, []],
                        ],
                    ],
                ],
            ],
            // A Site with no place names sits at the top.
            ['', null, 1, []],
            ['Gulu', 'District', 1, [['Gulu HC', null, 1, []]]],
        ]);
    });

    it('keeps every Session at or below a chosen place', () => {
        const keep = (...places: string[]) =>
            ids(filterSessionRows(rows, { ...NO_FILTERS, places }));
        expect(keep(keyOf('Buyende'))).toEqual([1, 2]);
        expect(keep(keyOf('Bukatube East'))).toEqual([2]);
        expect(keep(keyOf('Gulu'), keyOf('Bukatube East'))).toEqual([2, 3]);
    });
});

describe('Session search', () => {
    const rows = [
        row(101, { deviceId: 7 }),
        row(202, {
            siteId: 3,
            siteName: 'Gulu HC',
            location: [{ level: 'District', name: 'Gulu' }],
        }),
    ];
    const search = (text: string) =>
        ids(filterSessionRows(rows, { ...NO_FILTERS, search: text }));

    it('matches Session, device, Site and place, ignoring case', () => {
        expect(search('202')).toEqual([202]);
        expect(search('#3')).toEqual([202]);
        expect(search('buyende')).toEqual([101]);
        expect(search('  ')).toEqual([101, 202]);
    });

    it('matches the collector who entered the Session', () => {
        expect(
            ids(
                filterSessionRows(
                    [row(1), row(2, { collectorName: 'Akello Grace' })],
                    { ...NO_FILTERS, search: 'grace' },
                ),
            ),
        ).toEqual([2]);
    });

    it('needs every word to match', () => {
        expect(search('gulu hc')).toEqual([202]);
        expect(search('gulu buyende')).toEqual([]);
    });
});

describe('sorting by time between images', () => {
    it('orders by each Session’s median gap, Sessions with no gap last', () => {
        const gaps = (...values: number[]) => ({
            handling: { images: 3, gaps: values },
        });
        const rows = [row(1), row(2, gaps(30, 10, 20)), row(3, gaps(5))];
        for (const direction of ['asc', 'desc'] as const) {
            expect(
                ids(
                    sortSessionRows(rows, {
                        column: 'timeBetweenImages',
                        direction,
                    }),
                ),
            ).toEqual(direction === 'asc' ? [3, 2, 1] : [2, 3, 1]);
        }
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
