import { describe, expect, it } from 'vitest';
import { areaKey } from './build-area-marks';
import { panelFigureRows } from './tile-figures-by-program';

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

const devices = [
    { programId: 1, area: 'Gulu', count: 2 },
    { programId: 1, area: 'Kitgum', count: 1 },
];
const plan = {
    expectedUsers: (programId: number) => (programId === 1 ? 12 : undefined),
    devices: (programId: number) => (programId === 1 ? 6 : undefined),
    areas: (programId: number) => (programId === 1 ? 3 : 0),
    sentinelSites: (programId: number) => (programId === 1 ? 3 : null),
    areaDevices: [],
};

describe('panelFigureRows', () => {
    it("gives each Program's users, sentinel sites and houses for the month", () => {
        expect(
            panelFigureRows(sessions, devices, '2026-09', null, plan),
        ).toEqual([
            {
                key: '1',
                programId: 1,
                area: null,
                figures: { users: 3, sentinelSites: 2, houses: 3 },
                expected: 12,
                devices: 3,
                plannedDevices: 6,
                plannedSentinelSites: 9,
            },
            {
                key: '3',
                programId: 3,
                area: null,
                figures: { users: 1, sentinelSites: 1, houses: 0 },
                expected: null,
                devices: 0,
                plannedDevices: null,
                plannedSentinelSites: null,
            },
        ]);
    });

    it('gives each selected Area its own line and share of the expected users', () => {
        const rows = panelFigureRows(
            sessions,
            devices,
            '2026-09',
            new Set([areaKey(1, 'Kitgum'), areaKey(1, 'Gulu')]),
            plan,
        );

        // 12 users and 6 devices planned, over the Program's 3 planned Areas,
        // though only 2 have Sessions in September.
        expect(rows).toEqual([
            {
                key: areaKey(1, 'Gulu'),
                programId: 1,
                area: 'Gulu',
                figures: { users: 2, sentinelSites: 1, houses: 2 },
                expected: 4,
                devices: 2,
                plannedDevices: 2,
                plannedSentinelSites: 3,
            },
            {
                key: areaKey(1, 'Kitgum'),
                programId: 1,
                area: 'Kitgum',
                figures: { users: 1, sentinelSites: 1, houses: 1 },
                expected: 4,
                devices: 1,
                plannedDevices: 2,
                plannedSentinelSites: 3,
            },
        ]);
    });

    it("reads devices against each Area's own plan where the Program has one", () => {
        const perArea = {
            ...plan,
            areaDevices: [
                { programId: 1, area: 'Gulu', planned: 3 },
                { programId: 1, area: 'Kitgum', planned: 6 },
            ],
        };

        const [program] = panelFigureRows(
            sessions,
            devices,
            '2026-09',
            null,
            perArea,
        );
        const areaRows = panelFigureRows(
            sessions,
            devices,
            '2026-09',
            new Set([areaKey(1, 'Kitgum'), areaKey(1, 'Lira')]),
            perArea,
        );

        expect(program.plannedDevices).toBe(9);
        expect(areaRows.map(row => [row.area, row.plannedDevices])).toEqual([
            ['Kitgum', 6],
            ['lira', null],
        ]);
    });
});
