import type { Program } from '@/api/program/validation/program-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import type { ProgressProgramData } from './build-progress';
import {
    buildProgressDevices,
    deviceFigures,
    deviceFiguresByCountry,
    devicesInSelection,
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

const august = { from: '2026-08', to: '2026-08' };
const inAugust = Date.UTC(2026, 7, 15);

describe('buildProgressDevices', () => {
    const ugandaSessions = [
        session(1, 1, 'Ann'),
        session(2, 1, 'Bob'),
        session(3, 2, 'Cat'),
        session(4, 2, 'Dan'),
        session(5, 2, 'Eve'),
        session(6, 3, 'Fay'),
    ];
    const ugandaData = (sessions = ugandaSessions) =>
        data(
            uganda,
            [site(1, 'Gulu', 'A'), site(2, 'Oyam', 'B'), site(3, 'Oyam', 'C')],
            sessions,
        );

    it('counts Uganda from September as one per VHT, two at most per village', () => {
        const [row] = buildProgressDevices([ugandaData()], september, plan);
        expect(row).toEqual({ programId: 1, active: 5, planned: 66 });
    });

    it('counts a Uganda village as one shared phone before September', () => {
        const sessions = ugandaSessions.map(row => ({
            ...row,
            submittedAt: inAugust,
            collectionDate: inAugust,
        }));
        const [row] = buildProgressDevices(
            [ugandaData(sessions)],
            august,
            plan,
        );
        expect(row).toEqual({ programId: 1, active: 3, planned: 24 });
    });

    it('counts only the last month’s submissions, without practice', () => {
        const [row] = buildProgressDevices(
            [
                ugandaData([
                    session(1, 1, 'Ann'),
                    { ...session(2, 2, 'Bob'), type: 'PRACTICE' },
                    // Collected in September, submitted in August.
                    { ...session(3, 3, 'Cat', 3, inAugust) },
                ]),
            ],
            { from: '2026-08', to: '2026-09' },
            plan,
        );
        expect(row.active).toBe(1);
    });

    const ghanaData = data(
        ghana,
        [site(9, 'Ashanti', 'A')],
        [session(1, 9, ''), session(2, 9, ''), session(3, 9, '', 2)],
    );

    it('counts distinct devices elsewhere, never above the plan', () => {
        expect(buildProgressDevices([ghanaData], september, null)[0]).toEqual({
            programId: 3,
            active: 0,
            planned: null,
        });
        expect(buildProgressDevices([ghanaData], september, plan)[0]).toEqual({
            programId: 3,
            // Devices 1 and 2: three would pass the plan of 2.
            active: 2,
            planned: 2,
        });
        const roomy = {
            ...plan,
            projectedDevices: [
                { programId: 3, month: '2026-09', projected: 5 },
            ],
        };
        expect(
            buildProgressDevices([ghanaData], september, roomy)[0].active,
        ).toBe(2);
    });

    it('counts devices for a Uganda Program the workbook lists no villages for', () => {
        const pilgrim: Program = {
            programId: 8,
            name: 'Pilgrim',
            country: 'Uganda',
        };
        const [row] = buildProgressDevices(
            [
                data(
                    pilgrim,
                    [site(1, 'Gulu', 'A')],
                    [session(1, 1, 'Ann', 7), session(2, 1, 'Bob', 7)],
                ),
            ],
            september,
            {
                ...plan,
                projectedDevices: [
                    { programId: 8, month: '2026-09', projected: 10 },
                ],
            },
        );
        expect(row.active).toBe(1);
    });
});

describe('deviceFigures', () => {
    const devices = [
        { programId: 1, active: 5, planned: 66 },
        { programId: 3, active: 0, planned: null },
        { programId: 4, active: 14, planned: 14 },
    ];

    it('adds the Programs with a plan, and has none when no Program does', () => {
        expect(deviceFigures(devices)).toEqual({ active: 19, planned: 80 });
        expect(deviceFigures(devices.slice(1, 2))).toEqual({
            active: 0,
            planned: null,
        });
    });

    it('shows Programs with a plan, narrowed to a selected Area’s', () => {
        expect(
            devicesInSelection(devices, null).map(row => row.programId),
        ).toEqual([1, 4]);
        expect(devicesInSelection(devices, [3, 4])).toEqual([devices[2]]);
    });
});

describe('deviceFiguresByCountry', () => {
    it('adds up each country’s planned Programs', () => {
        const programs: Program[] = [
            uganda,
            { programId: 8, name: 'Pilgrim', country: 'Uganda' },
            ghana,
            { programId: 2, name: 'Colombia', country: 'Colombia' },
        ];
        const figures = deviceFiguresByCountry(
            [
                { programId: 1, active: 51, planned: 66 },
                { programId: 8, active: 2, planned: 10 },
                { programId: 3, active: 4, planned: 4 },
                { programId: 2, active: 0, planned: null },
            ],
            programs,
        );
        expect(Object.fromEntries(figures)).toEqual({
            Uganda: { active: 53, planned: 76 },
            Ghana: { active: 4, planned: 4 },
        });
    });
});
