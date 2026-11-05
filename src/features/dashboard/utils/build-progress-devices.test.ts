import type { Program } from '@/api/program/validation/program-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import { buildProgress, type ProgressProgramData } from './build-progress';
import {
    buildProgressDevices,
    deviceFigures,
    devicesInSelection,
    namedAreas,
} from './build-progress-devices';

const site = (siteId: number, district: string, village: string): Site =>
    ({
        siteId,
        name: village,
        district,
        villageName: village,
        houseNumber: `H${siteId}`,
        locationHierarchy: {},
    }) as Site;

const session = (
    sessionId: number,
    siteId: number,
    collectorName: string,
    deviceId = sessionId,
    submittedAt = Date.UTC(2026, 8, 15),
) => ({
    sessionId,
    siteId,
    deviceId,
    collectorName,
    type: 'SURVEILLANCE',
    collectionDate: submittedAt,
    submittedAt,
    latitude: null,
    longitude: null,
});

const data = (
    program: Program,
    sites: Site[],
    sessions: ReturnType<typeof session>[],
): ProgressProgramData => ({
    program,
    snapshot: {
        programId: program.programId,
        sessions,
        specimenCounts: [],
        sites,
        collectionCycles: [],
        fetchedAt: 1,
    },
});

const uganda: Program = { programId: 1, name: 'Uganda', country: 'Uganda' };
const ghana: Program = { programId: 3, name: 'Ghana', country: 'Ghana' };
const unit = (programId: number, name: string) => ({
    programId,
    unit: name,
    status: 'Active' as const,
    boundary: null,
    region: null,
});
const plan = {
    units: [unit(1, 'Gulu'), unit(1, 'Oyam'), unit(3, 'Ashanti')],
    projectedDevices: [
        { programId: 1, month: '2026-08', projected: 24 },
        { programId: 1, month: '2026-09', projected: 66 },
        { programId: 3, month: '2026-08', projected: 2 },
    ],
};
const september = { from: '2026-09', to: '2026-09' };

describe('buildProgressDevices', () => {
    const programs = [
        data(
            uganda,
            [site(1, 'Gulu', 'A'), site(2, 'Oyam', 'B'), site(3, 'Oyam', 'C')],
            [
                session(1, 1, 'Ann'),
                session(2, 1, 'Bob'),
                session(3, 2, 'Cat'),
                session(4, 2, 'Dan'),
                session(5, 2, 'Eve'),
                session(6, 3, 'Fay'),
            ],
        ),
    ];

    it('counts Uganda by the team’s rule, against 3 or 6 per District', () => {
        const [row] = buildProgressDevices(programs, september, plan);
        expect(row.active).toBe(4);
        expect(row.planned).toBe(9);
        expect(row.areas).toEqual([
            // A shared-phone village is one device, however many people.
            { name: 'Gulu', active: 1, planned: 3 },
            // Each person is a device, two at most per village.
            { name: 'Oyam', active: 3, planned: 6 },
        ]);
    });

    it('uses the workbook before the rule starts', () => {
        const [row] = buildProgressDevices(
            programs,
            { from: '2026-08', to: '2026-08' },
            plan,
        );
        expect(row.planned).toBe(24);
        expect(row.areas).toEqual([]);
    });

    const place = (siteId: number, district: string, town: string) =>
        ({
            siteId,
            name: town,
            locationHierarchy: {
                Region: 'Ashanti',
                District: district,
                Town: town,
            },
        }) as Site;
    const ghanaData = data(
        ghana,
        [
            place(9, 'Tarkwa', 'A'),
            place(10, 'Tarkwa', 'B'),
            place(11, 'Ejura', 'C'),
        ],
        // Many device ids at one site are still one device.
        [
            session(1, 9, ''),
            session(2, 9, ''),
            session(3, 10, ''),
            session(4, 11, ''),
        ],
    );

    it('counts a device per active Sentinel Site elsewhere, lines adding up to the plan', () => {
        const [row] = buildProgressDevices([ghanaData], september, plan);
        expect(row.planned).toBe(2);
        expect(row.active).toBe(2);
        expect(row.areas.reduce((sum, area) => sum + area.active, 0)).toBe(2);
    });

    it('names Areas as the map does, so selecting one finds its devices', () => {
        for (const program of [ghanaData, programs[0]]) {
            const devices = buildProgressDevices([program], september, plan);
            const { districts } = buildProgress([program], september);
            expect(devices[0].areas.map(area => area.name).sort()).toEqual(
                districts.map(district => district.name).sort(),
            );
            for (const district of districts)
                expect(devicesInSelection(devices, district)).toHaveLength(1);
        }
    });

    it('leaves Uganda Districts outside the plan out of the count', () => {
        const [row] = buildProgressDevices(
            [
                data(
                    uganda,
                    [site(1, 'Gulu', 'A'), site(2, 'Lira', 'B')],
                    [session(1, 1, 'Ann'), session(2, 2, 'Bob')],
                ),
            ],
            september,
            plan,
        );
        expect(row.active).toBe(1);
        expect(row.areas.map(area => area.name)).toEqual(['Gulu']);
    });

    it('still counts without a plan', () => {
        const [row] = buildProgressDevices(programs, september, null);
        expect(row.planned).toBeNull();
        expect(row.areas.map(area => area.planned)).toEqual([null, null]);
    });
});

describe('deviceFigures', () => {
    const devices = [
        {
            programId: 1,
            active: 1,
            planned: 9,
            areas: [{ name: 'Gulu', active: 1, planned: 3 }],
        },
        {
            programId: 3,
            active: 2,
            planned: null,
            areas: [{ name: 'Ashanti', active: 2, planned: null }],
        },
    ];

    it('adds the plans that exist, and has none when no Program does', () => {
        expect(deviceFigures(devices)).toEqual({ active: 3, planned: 9 });
        expect(deviceFigures(devices.slice(1))).toEqual({
            active: 2,
            planned: null,
        });
    });

    it('lists Areas only when they add something', () => {
        const row = (...names: string[]) => ({
            programId: 1,
            active: 1,
            planned: null,
            areas: names.map(name => ({ name, active: 1, planned: null })),
        });
        expect(namedAreas(row('Gulu'))).toEqual([]);
        expect(namedAreas(row('District not recorded', 'Gulu'))).toEqual([]);
        expect(namedAreas(row('Gulu', 'Oyam'))).toHaveLength(2);
    });

    it('narrows to a selected Area, plan included', () => {
        const shown = devicesInSelection(devices, {
            name: 'GULU',
            programIds: [1],
        });
        expect(shown).toHaveLength(1);
        expect(deviceFigures(shown)).toEqual({ active: 1, planned: 3 });
    });

    it('lists Areas alphabetically', () => {
        const [row] = devicesInSelection(
            [
                {
                    programId: 1,
                    active: 2,
                    planned: null,
                    areas: [
                        { name: 'Oyam', active: 1, planned: null },
                        { name: 'Gulu', active: 1, planned: null },
                    ],
                },
            ],
            null,
        );
        expect(row.areas.map(area => area.name)).toEqual(['Gulu', 'Oyam']);
    });
});
