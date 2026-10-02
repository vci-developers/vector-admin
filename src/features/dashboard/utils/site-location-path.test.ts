import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import { siteLocationPath } from './site-location-path';

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
