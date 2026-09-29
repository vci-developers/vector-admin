import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import { buildSiteLocationQuery, fallbackQueries } from './site-location-query';

const site = (overrides: Partial<Site>): Site => ({
    siteId: 1,
    name: null,
    district: null,
    subCounty: null,
    parish: null,
    villageName: null,
    locationHierarchy: {},
    ...overrides,
});

describe('buildSiteLocationQuery', () => {
    it('uses village and district for legacy Sites, cleaning admin suffixes', () => {
        expect(
            buildSiteLocationQuery(
                site({
                    district: 'Mayuge District',
                    subCounty: 'Mayuge DLG',
                    parish: 'Bukatube Subcounty',
                    villageName: 'Bukatube Subcounty',
                }),
                'Uganda',
            ),
        ).toBe('Bukatube, Mayuge, Uganda');
    });

    it('uses the Site name and its top region for hierarchical Sites', () => {
        expect(
            buildSiteLocationQuery(
                site({
                    name: 'Tarkwa',
                    locationHierarchy: {
                        Region: 'Western',
                        District: 'Tarkwa',
                    },
                }),
                'Ghana',
            ),
        ).toBe('Tarkwa, Western, Ghana');
    });

    it('falls back to the country when a Site has no place names', () => {
        expect(buildSiteLocationQuery(site({}), 'Kenya')).toBe('Kenya');
    });
});

describe('fallbackQueries', () => {
    it('broadens from most to least specific', () => {
        expect(fallbackQueries('Bukatube, Mayuge, Uganda')).toEqual([
            'Bukatube, Mayuge, Uganda',
            'Mayuge, Uganda',
            'Uganda',
        ]);
    });
});
