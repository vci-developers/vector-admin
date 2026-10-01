import type { Session } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { buildLocationTree, siteLocationPath } from './build-location-tree';

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
    buildLocationTree(
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

const summarize = (nodes: ReturnType<typeof build>) =>
    nodes.map(node => [node.name, node.metrics.activeDevices]);

describe('siteLocationPath', () => {
    it('reads legacy fields broadest first, skipping N/A levels', () => {
        const site = legacySite(1, {
            district: 'Turkana',
            subCounty: 'Turkana South',
            healthCenter: 'N/A',
            parish: 'N/A',
            villageName: 'Kapese',
            houseNumber: 'V2322-001-01',
        });

        expect(siteLocationPath(site)).toEqual([
            { level: 'District', name: 'Turkana' },
            { level: 'Sub-county', name: 'Turkana South' },
            { level: 'Village', name: 'Kapese' },
            { level: 'House', name: 'V2322-001-01' },
        ]);
    });

    it('reads a newer Site from its own ordered hierarchy', () => {
        const site = hierarchySite(2, {
            Region: 'Western',
            District: 'Tarkwa Nsuaem',
            'Town/Village': 'Tamso',
        });

        expect(siteLocationPath(site)).toEqual([
            { level: 'Region', name: 'Western' },
            { level: 'District', name: 'Tarkwa Nsuaem' },
            { level: 'Town/Village', name: 'Tamso' },
        ]);
    });
});

describe('buildLocationTree', () => {
    it('counts each Device once per location, merging Sites by name', () => {
        const sites = [
            legacySite(1, { district: 'Gulu', villageName: 'Laroo' }),
            legacySite(2, { district: 'Gulu', villageName: 'Pece' }),
            legacySite(3, { district: 'Mayuge', villageName: 'Bukatube' }),
        ];
        const nodes = build(sites, [
            session(1, 10, 1),
            session(2, 10, 1),
            session(3, 11, 2),
            session(4, 12, 3),
        ]);

        expect(summarize(nodes)).toEqual([
            ['Gulu', 2],
            ['Bukatube', 1],
            ['Laroo', 1],
            ['Mayuge', 1],
            ['Pece', 1],
        ]);
        const gulu = nodes.find(node => node.name === 'Gulu');
        const laroo = nodes.find(node => node.name === 'Laroo');
        expect(gulu?.parentKey).toBeNull();
        expect(laroo?.parentKey).toBe(gulu?.key);
    });

    it('counts a Device that moved under each Site but once in their parent', () => {
        const sites = [
            hierarchySite(1, { Region: 'Western', District: 'Tarkwa' }),
            hierarchySite(2, { Region: 'Western', District: 'Wassa' }),
        ];
        const nodes = build(sites, [session(1, 10, 1), session(2, 10, 2)]);

        expect(summarize(nodes)).toEqual([
            ['Tarkwa', 1],
            ['Wassa', 1],
            ['Western', 1],
        ]);
    });

    it('keeps same-named places under different parents apart', () => {
        const sites = [
            hierarchySite(1, { Region: 'North', District: 'Central' }),
            hierarchySite(2, { Region: 'South', District: 'Central' }),
        ];
        const nodes = build(sites, [session(1, 10, 1), session(2, 11, 2)]);

        expect(nodes.filter(node => node.name === 'Central')).toHaveLength(2);
    });

    it('ignores uncounted Sessions and Sessions outside the period', () => {
        const sites = [legacySite(1, { district: 'Gulu' })];
        const nodes = build(sites, [
            session(1, 10, 1, { type: 'PRACTICE' }),
            session(2, 11, 1, { collectionDate: JAN }),
        ]);

        expect(nodes).toEqual([]);
    });

    it('puts Sessions at an unknown or empty Site under one unknown node', () => {
        const sites = [legacySite(1, { district: 'N/A' })];
        const nodes = build(sites, [session(1, 10, 1), session(2, 11, 99)]);

        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({
            key: '1:unknown',
            parentKey: null,
            level: null,
            name: null,
        });
        expect(nodes[0].metrics.activeDevices).toBe(2);
    });

    it('sums Images and Specimens up the hierarchy and leaves users blank', () => {
        const sites = [
            legacySite(1, { district: 'Gulu', villageName: 'Laroo' }),
            legacySite(2, { district: 'Gulu', villageName: 'Pece' }),
        ];
        const nodes = build(
            sites,
            [session(1, 10, 1), session(2, 11, 2)],
            [specimen(1, 1, 3), specimen(2, 1), specimen(3, 2, 2)],
        );
        const byName = new Map(nodes.map(node => [node.name, node.metrics]));

        expect(byName.get('Laroo')).toMatchObject({
            images: 4,
            uniqueSpecimens: 2,
            imagesPerActiveDevice: 4,
        });
        expect(byName.get('Gulu')).toMatchObject({
            activeDevices: 2,
            images: 6,
            uniqueSpecimens: 3,
            imagesPerActiveDevice: 3,
            uniqueUsers: null,
            logins: null,
        });
    });

    it('counts DHIS2 states per place for Uganda', () => {
        const sites = [legacySite(1, { district: 'Gulu' })];
        const nodes = build(sites, [
            session(1, 10, 1, { state: 'SUBMITTED' }),
            session(2, 10, 1, { state: 'CERTIFIED' }),
        ]);

        expect(nodes[0].metrics.dhis2UploadRate).toBe(0.5);
    });
});
