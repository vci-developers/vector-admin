import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { describe, expect, it } from 'vitest';
import { placeBySite, sitesToLocate } from './place-by-site';

const KAMPALA = { latitude: 0.35, longitude: 32.58 };
const KAMPALA_PATH = [
    { level: 'District', name: 'Kampala' },
    { level: 'Village', name: 'Kololo' },
];

type DeviceRow = Dashboard['devices'][number];
const device = (
    deviceId: number,
    overrides: Partial<DeviceRow> = {},
): DeviceRow => ({
    deviceId,
    model: 'm',
    programId: 7,
    status: 'ACTIVE',
    position: null,
    siteId: null,
    lastSubmittedAt: 1,
    ...overrides,
});

const session = (sessionId: number, siteId: number) => ({
    sessionId,
    programId: 7,
    deviceId: 1,
    siteId,
    specimenCount: 3,
    collectedAt: 1,
});

function dashboard(
    devices: DeviceRow[],
    unplacedSessions: ReturnType<typeof session>[] = [],
) {
    return {
        devices,
        specimenPoints: { placed: [], unplaced: unplacedSessions },
        sitePaths: { 10: KAMPALA_PATH },
    } as unknown as Dashboard;
}

const sites = {
    locations: { 10: { ...KAMPALA, query: 'Kampala, Uganda' }, 11: null },
    pending: new Set([12]),
};

describe('placeBySite', () => {
    it('keeps GPS positions and only uses the Site when GPS is missing', () => {
        const { devices } = placeBySite(
            dashboard([
                device(1, {
                    position: { latitude: 1, longitude: 32 },
                    siteId: 10,
                }),
                device(2, { siteId: 10 }),
            ]),
            sites,
        );

        expect(devices.placed.map(d => [d.deviceId, d.placement.by])).toEqual([
            [1, 'gps'],
            [2, 'site'],
        ]);
        expect(devices.placed[1].position).toEqual(KAMPALA);
    });

    it('flags what the Site cannot place, and why', () => {
        const { devices, sessions } = placeBySite(
            dashboard(
                [
                    device(1, { siteId: 11 }),
                    device(2, { siteId: 12 }),
                    device(3),
                ],
                [session(1, 10), session(2, 11)],
            ),
            sites,
        );

        expect(devices.unplaced.map(d => [d.deviceId, d.reason])).toEqual([
            [1, 'noLocation'],
            [2, 'locating'],
            [3, 'noLocation'],
        ]);
        expect(sessions.placed.map(s => [s.sessionId, s.placement.by])).toEqual(
            [[1, 'site']],
        );
        expect(sessions.unplaced.map(s => [s.sessionId, s.reason])).toEqual([
            [2, 'noLocation'],
        ]);
    });

    it("gives each placed point its Site's place names", () => {
        const { devices, sessions } = placeBySite(
            dashboard(
                [device(1, { siteId: 10 }), device(2, { position: KAMPALA })],
                [session(1, 10)],
            ),
            sites,
        );

        expect(devices.placed.map(d => d.location)).toEqual([KAMPALA_PATH, []]);
        expect(sessions.placed[0].location).toEqual(KAMPALA_PATH);
    });

    it('ignores never-used devices', () => {
        const { devices } = placeBySite(
            dashboard([device(1, { status: 'NEVER_USED', siteId: 10 })]),
            sites,
        );
        expect(devices).toEqual({ placed: [], unplaced: [] });
    });
});

describe('sitesToLocate', () => {
    it('asks only for Sites of things GPS could not place', () => {
        expect(
            sitesToLocate(
                dashboard(
                    [
                        device(1, { position: KAMPALA, siteId: 1 }),
                        device(2, { siteId: 3 }),
                        device(3, { status: 'NEVER_USED', siteId: 4 }),
                    ],
                    [session(1, 2), session(2, 3)],
                ),
            ),
        ).toEqual([2, 3]);
    });
});
