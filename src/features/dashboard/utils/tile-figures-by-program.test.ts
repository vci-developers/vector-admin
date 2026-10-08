import { describe, expect, it } from 'vitest';
import { areaKey } from './build-area-marks';
import { tileFiguresByProgram } from './tile-figures-by-program';

const house = (district: string, village: string, house: string) => [
    { level: 'District', name: district },
    { level: 'Village', name: village },
    { level: 'House', name: house },
];

const sessions = [
    {
        programId: 1,
        siteId: 1,
        month: '2026-09',
        collectorIds: [1, 2],
        location: house('Gulu', 'Coopil', '1'),
    },
    {
        programId: 1,
        siteId: 2,
        month: '2026-09',
        collectorIds: [2],
        location: house('Gulu', 'Coopil', '2'),
    },
    {
        programId: 1,
        siteId: 3,
        month: '2026-09',
        collectorIds: [3],
        location: house('Kitgum', 'Lagwel', '1'),
    },
    {
        programId: 1,
        siteId: 4,
        month: '2026-08',
        collectorIds: [4],
        location: house('Gulu', 'Laminto', '1'),
    },
    // A Site that is itself the sentinel site (no House level).
    {
        programId: 3,
        siteId: 9,
        month: '2026-09',
        collectorIds: [1],
        location: [{ level: 'Region', name: 'Ashanti' }],
    },
];

describe('tileFiguresByProgram', () => {
    it("gives each Program's users, sentinel sites and houses for the month", () => {
        expect(tileFiguresByProgram(sessions, '2026-09')).toEqual(
            new Map([
                [1, { users: 3, sentinelSites: 2, houses: 3 }],
                [3, { users: 1, sentinelSites: 1, houses: 0 }],
            ]),
        );
    });

    it('counts only the given Areas', () => {
        expect(
            tileFiguresByProgram(
                sessions,
                '2026-09',
                new Set([areaKey(1, 'Gulu')]),
            ),
        ).toEqual(new Map([[1, { users: 2, sentinelSites: 1, houses: 2 }]]));
    });
});
