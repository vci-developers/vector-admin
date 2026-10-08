import { describe, expect, it } from 'vitest';
import { searchMap, unitSessionIds } from './search-map';

const path = (...names: string[]) =>
    names.map((name, index) => ({
        level: ['District', 'Sub-county', 'Village'][index],
        name,
    }));

const session = (
    sessionId: number,
    siteId: number,
    location = path(),
    programId = 1,
) => ({
    sessionId,
    siteId,
    location,
    programId,
});
const device = (
    deviceId: number,
    siteId: number | null,
    location = path(),
) => ({
    deviceId,
    siteId,
    location,
});

const sessions = [
    session(101, 1, path('Gulu', 'Bobi', 'Aleu')),
    session(102, 2, path('Gulu', 'Bobi', 'Labwor')),
    session(1010, 3, path('Lira', 'Agulu')),
];
const devices = [
    device(10, 1, path('Gulu', 'Bobi', 'Aleu')),
    device(20, 4, path('Kitgum')),
];

const summary = (query: string) =>
    searchMap(query, sessions, devices).map(result => [
        result.key,
        result.layer,
        result.ids,
    ]);

describe('searchMap', () => {
    it('finds places at any level, with the points beneath them', () => {
        expect(summary('bobi')).toEqual([
            ['place:District=Gulu/Sub-county=Bobi', 'specimens', [101, 102]],
        ]);
        const [aleu] = searchMap('ALEU', sessions, devices);
        expect(aleu).toMatchObject({
            kind: 'place',
            name: 'Aleu',
            level: 'Village',
            context: ['Gulu', 'Bobi'],
        });
    });

    it('ranks names starting with the query first, then bigger places', () => {
        expect(summary('gulu').map(([key]) => key)).toEqual([
            'place:District=Gulu',
            'place:District=Lira/Sub-county=Agulu',
        ]);
    });

    it('selects devices for a place with no specimen points', () => {
        expect(summary('kitgum')).toEqual([
            ['place:District=Kitgum', 'devices', [20]],
        ]);
    });

    it('finds Sessions, devices and Sites by number, exact ids first', () => {
        expect(summary('10').map(([key]) => key)).toEqual([
            'device:10',
            'session:101',
            'session:102',
            'session:1010',
        ]);
        expect(summary('#4')).toEqual([['site:4', 'devices', [20]]]);
        expect(searchMap('3', sessions, devices)[0]).toMatchObject({
            kind: 'site',
            siteId: 3,
            name: 'Agulu',
        });
    });

    it('finds nothing for an empty query', () => {
        expect(summary('  ')).toEqual([]);
    });

    it('finds Coverage Units by name, with or without points, over the same-named place', () => {
        const units = [
            {
                programId: 1,
                unit: 'Gulu',
                status: 'Active' as const,
                sessionIds: [101, 102],
            },
            {
                programId: 1,
                unit: 'Lamwo',
                status: 'Targeted' as const,
                sessionIds: [],
            },
        ];

        expect(
            searchMap('gul', sessions, devices, units).map(r => [r.key, r.ids]),
        ).toEqual([
            ['unit:1:Gulu', [101, 102]],
            ['place:District=Lira/Sub-county=Agulu', [1010]],
        ]);
        expect(searchMap('lamwo', sessions, devices, units)).toEqual([
            {
                key: 'unit:1:Lamwo',
                kind: 'unit',
                unit: { programId: 1, unit: 'Lamwo' },
                status: 'Targeted',
                layer: 'specimens',
                ids: [],
            },
        ]);
    });

    it('keeps places below a unit that share its name searchable', () => {
        const units = [
            {
                programId: 1,
                unit: 'Bobi',
                status: 'Active' as const,
                sessionIds: [],
            },
        ];

        expect(
            searchMap('bobi', sessions, devices, units).map(r => r.key),
        ).toEqual(['place:District=Gulu/Sub-county=Bobi', 'unit:1:Bobi']);
    });
});

describe('unitSessionIds', () => {
    it("takes the unit's Program's Sessions whose top-level place it names", () => {
        const all = [
            ...sessions,
            session(201, 9, path('GULU')),
            session(202, 9, path('Gulu'), 4),
            session(203, 9, path('Amuru', 'Gulu')),
        ];

        expect(unitSessionIds({ programId: 1, unit: 'gulu' }, all)).toEqual([
            101, 102, 201,
        ]);
    });
});
