import type { LocationLevel } from './site-location-path';

type Located = { siteId: number | null; location: LocationLevel[] };

// Legacy Sites end in "House" (Uganda, Kenya); place hierarchies in "Household" (Ghana).
const HOUSEHOLD_LEVELS = new Set(['house', 'household']);

const isHousehold = (location: LocationLevel[]) =>
    HOUSEHOLD_LEVELS.has(location.at(-1)?.level.toLowerCase() ?? '');

const pathKey = (location: LocationLevel[]) =>
    location.map(({ level, name }) => `${level}=${name}`).join('/');

/**
 * A Sentinel Site is the place directly above a household-level Site (a
 * village in Uganda and Kenya, a named Sentinel Site in Ghana), else the Site
 * itself (a town, a health district). Places are matched by path, so Sessions
 * at a Sentinel Site and at its households count it once. Households are
 * counted too, where Sites are households.
 */
export function countSentinelSites(items: Located[]): {
    sentinelSites: number;
    houses: number;
} {
    const sentinelSites = new Set<string>();
    const houses = new Set<number>();
    for (const { siteId, location } of items) {
        if (siteId === null) continue;
        if (isHousehold(location)) {
            houses.add(siteId);
            sentinelSites.add(pathKey(location.slice(0, -1)));
        } else
            sentinelSites.add(
                location.length > 0 ? pathKey(location) : `site:${siteId}`,
            );
    }
    return { sentinelSites: sentinelSites.size, houses: houses.size };
}
