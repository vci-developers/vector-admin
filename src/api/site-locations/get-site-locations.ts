import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import { siteGeocoder } from '@/api/geocode/geocode-sites';
import type {
    GetSiteLocationsQuery,
    SiteLocations,
} from '@/api/site-locations/validation/site-locations-schema';
import { buildSiteLocationQuery } from '@/features/dashboard/utils/site-location-query';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';

export async function getSiteLocations({
    exclude,
    siteIds,
}: GetSiteLocationsQuery): Promise<Result<SiteLocations, NetworkError>> {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const wanted = new Set(siteIds);
    const lookups = new Map<
        number,
        { key: string; query: string; country: string }
    >();
    for (const program of programs.data.filter(
        p => !exclude.includes(p.programId),
    )) {
        const snapshot = await loadProgramSnapshot(program.programId);
        if (!snapshot.ok) continue;
        for (const site of snapshot.data.sites) {
            if (!wanted.has(site.siteId)) continue;
            const query = buildSiteLocationQuery(site, program.country);
            // Keyed by place name so Sites in the same village share one lookup.
            lookups.set(site.siteId, {
                key: `${program.country}|${query}`,
                query,
                country: program.country,
            });
        }
    }

    const { resolved, pending } = siteGeocoder.lookup([...lookups.values()]);
    const pendingKeys = new Set(pending);
    const locations: SiteLocations['locations'] = {};
    const pendingSiteIds: number[] = [];
    for (const siteId of siteIds) {
        const lookup = lookups.get(siteId);
        if (!lookup) {
            locations[siteId] = null;
        } else if (pendingKeys.has(lookup.key)) {
            pendingSiteIds.push(siteId);
        } else {
            const point = resolved.get(lookup.key);
            locations[siteId] = point
                ? { ...point, query: lookup.query }
                : null;
        }
    }
    return ok({ locations, pending: pendingSiteIds });
}
