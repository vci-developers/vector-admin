import {
    getSiteLocationsResponseSchema,
    type SiteLocations,
} from '@/api/site-locations/validation/site-locations-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, type Result } from '@/lib/result/result';
import { useQuery } from '@tanstack/react-query';

async function fetchSiteLocations(
    exclude: number[],
    siteIds: number[],
): Promise<Result<SiteLocations, NetworkError>> {
    const search = new URLSearchParams({
        exclude: exclude.join(','),
        siteIds: siteIds.join(','),
    });
    const response = await fetch(`/api/site-locations?${search}`, {
        credentials: 'include',
    }).catch(() => null);
    if (!response) return err({ kind: 'network' });

    const body = getSiteLocationsResponseSchema.safeParse(
        await response.json().catch(() => null),
    );
    return body.success
        ? body.data
        : err({ kind: 'client', status: response.status });
}

// Geocoding runs in the background at one Site per second; poll until done.
export function useGetSiteLocations(exclude: number[], siteIds: number[]) {
    return useQuery({
        queryKey: ['site-locations', exclude, siteIds],
        queryFn: () => fetchSiteLocations(exclude, siteIds),
        enabled: siteIds.length > 0,
        refetchInterval: query =>
            query.state.data?.ok && query.state.data.data.pending.length > 0
                ? 3000
                : false,
    });
}
