import { describe, expect, it } from 'vitest';
import { searchMap } from './search-map';

const path = (...names: string[]) =>
    names.map((name, index) => ({
        level: ['District', 'Sub-county', 'Village'][index],
        name,
    }));

const session = (sessionId: number, siteId: number, location = path()) => ({
    sessionId,
    siteId,
    location,
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
});
