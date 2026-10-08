import type { LocationLevel } from './site-location-path';

type Located = { siteId: number | null; location: LocationLevel[] };

/** Legacy Sites end in a House level when each Site is one house. */
const isHouse = (location: LocationLevel[]) =>
    location.at(-1)?.level === 'House';

/**
 * A Sentinel Site is where collections happen: the village a house-level Site
 * sits in (Uganda, Kenya), else the Site itself (a town, a hierarchy point).
 * Houses are counted too, where Sites are houses.
 */
export function countSentinelSites(items: Located[]): {
    sentinelSites: number;
    houses: number;
} {
    const sentinelSites = new Set<string>();
    const houses = new Set<number>();
    for (const { siteId, location } of items) {
        if (siteId === null) continue;
        if (isHouse(location)) {
            houses.add(siteId);
            sentinelSites.add(
                location
                    .slice(0, -1)
                    .map(({ level, name }) => `${level}=${name}`)
                    .join('/'),
            );
        } else sentinelSites.add(`site:${siteId}`);
    }
    return { sentinelSites: sentinelSites.size, houses: houses.size };
}
