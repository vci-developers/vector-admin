import type { Session } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { buildAreaMetrics } from './build-area-metrics';

function legacySite(siteId: number, fields: Partial<Site>): Site {
    return { siteId, name: null, locationHierarchy: {}, ...fields };
}

function hierarchySite(
    siteId: number,
    locationHierarchy: Record<string, string>,
): Site {
    return {
        siteId,
        name: Object.values(locationHierarchy).at(-1) ?? null,
        locationHierarchy,
    };
}

const MAR = Date.UTC(2026, 2, 10);
const JAN = Date.UTC(2026, 0, 10);

function session(
    sessionId: number,
    deviceId: number,
    siteId: number,
    overrides: Partial<Session> = {},
): Session {
    return {
        sessionId,
        deviceId,
        siteId,
        type: 'SURVEILLANCE',
        collectorName: 'Jane Doe',
        collectionDate: MAR,
        createdAt: MAR,
        submittedAt: MAR,
        latitude: null,
        longitude: null,
        ...overrides,
    };
}

const build = (
    sites: Site[],
    sessions: Session[],
    specimens: Specimen[] = [],
) =>
    buildAreaMetrics(
        {
            program: { programId: 1, name: 'NMED', country: 'Uganda' },
            snapshot: {
                programId: 1,
                sessions,
                specimens,
                devices: [],
                collectionCycles: [],
                userLogins: [],
                sites,
                fetchedAt: 0,
            },
        },
        { from: '2026-03', to: '2026-03' },
    );

function specimen(id: number, sessionId: number, imageCount = 1): Specimen {
    return {
        id,
        sessionId,
        images: Array.from({ length: imageCount }, (_, i) => ({
            id: id * 10 + i,
        })),
        thumbnailImage: { species: 'Anopheles gambiae' },
    };
}

const summarize = (areas: ReturnType<typeof build>) =>
    areas.map(area => [area.name, area.metrics.activeDevices]);

describe('buildAreaMetrics', () => {
    it('gives each top-level area a row, alphabetically, a Device once in each', () => {
        const sites = [
            legacySite(1, { district: 'Mayuge', villageName: 'Bukatube' }),
            legacySite(2, { district: 'Gulu', villageName: 'Laroo' }),
            legacySite(3, { district: 'Gulu', villageName: 'Pece' }),
            hierarchySite(4, { Region: 'Western', District: 'Tarkwa' }),
        ];
        const areas = build(sites, [
            session(1, 10, 1),
            session(2, 11, 2),
            session(3, 11, 3),
            session(4, 10, 4),
        ]);

        expect(summarize(areas)).toEqual([
            ['Gulu', 1],
            ['Mayuge', 1],
            ['Western', 1],
        ]);
        expect(areas.map(area => area.level)).toEqual([
            'District',
            'District',
            'Region',
        ]);
    });

    it('ignores Sessions outside the period', () => {
        const sites = [legacySite(1, { district: 'Gulu' })];
        expect(
            build(sites, [session(1, 10, 1, { collectionDate: JAN })]),
        ).toEqual([]);
    });

    it('puts Sessions at an unknown or empty Site in one unnamed area, last', () => {
        const sites = [
            legacySite(1, { district: 'N/A' }),
            legacySite(2, { district: 'Gulu' }),
        ];
        const areas = build(sites, [
            session(1, 10, 1),
            session(2, 11, 99),
            session(3, 12, 2),
        ]);

        expect(summarize(areas)).toEqual([
            ['Gulu', 1],
            [null, 2],
        ]);
        expect(areas[1].level).toBeNull();
    });

    it('sums Images and Specimens across Sites and leaves users blank', () => {
        const sites = [
            legacySite(1, { district: 'Gulu', villageName: 'Laroo' }),
            legacySite(2, { district: 'Gulu', villageName: 'Pece' }),
        ];
        const [gulu] = build(
            sites,
            [session(1, 10, 1), session(2, 11, 2)],
            [specimen(1, 1, 3), specimen(2, 1), specimen(3, 2, 2)],
        );

        expect(gulu.metrics).toMatchObject({
            activeDevices: 2,
            images: 6,
            uniqueSpecimens: 3,
            imagesPerActiveDevice: 3,
            uniqueUsers: null,
            logins: null,
        });
    });
});
