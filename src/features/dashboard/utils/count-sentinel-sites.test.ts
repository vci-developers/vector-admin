import { describe, expect, it } from 'vitest';
import { countSentinelSites } from './count-sentinel-sites';

const legacy = (...names: string[]) =>
    names.map((name, index) => ({
        level: ['District', 'Sub-county', 'Village', 'House'][index],
        name,
    }));

describe('countSentinelSites', () => {
    it('counts the village above house-level Sites, and the houses', () => {
        expect(
            countSentinelSites([
                {
                    siteId: 12,
                    location: legacy('Koboko', 'Ludara', 'Akuluze', 'KLLA001'),
                },
                {
                    siteId: 13,
                    location: legacy('Koboko', 'Ludara', 'Akuluze', 'KLLA002'),
                },
                {
                    siteId: 13,
                    location: legacy('Koboko', 'Ludara', 'Akuluze', 'KLLA002'),
                },
                {
                    siteId: 40,
                    location: legacy('Koboko', 'Ludara', 'Ombaci', 'KLLB001'),
                },
            ]),
        ).toEqual({ sentinelSites: 2, houses: 3 });
    });

    it('keeps villages of the same name in different places apart', () => {
        expect(
            countSentinelSites([
                { siteId: 1, location: legacy('Gulu', 'Bobi', 'Aleu', 'H1') },
                { siteId: 2, location: legacy('Lira', 'Agulu', 'Aleu', 'H1') },
            ]).sentinelSites,
        ).toBe(2);
    });

    it('counts a Site with no house as its own Sentinel Site', () => {
        const hierarchy = [
            { level: 'Region', name: 'Ashanti' },
            { level: 'Site', name: 'EJS-HLC-03' },
        ];
        expect(
            countSentinelSites([
                { siteId: 7, location: legacy('Antioquia', 'Turbo', 'Turbo') },
                { siteId: 8, location: hierarchy },
                { siteId: 8, location: hierarchy },
                { siteId: null, location: [] },
            ]),
        ).toEqual({ sentinelSites: 2, houses: 0 });
    });
});
