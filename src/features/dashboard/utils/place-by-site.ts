import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import type { SiteLocations } from '@/api/site-locations/validation/site-locations-schema';
import type { LocationLevel } from './build-location-tree';

type DeviceRow = Dashboard['devices'][number];
type Point = { latitude: number; longitude: number };

export type Placement =
    | { by: 'gps' }
    /** No usable GPS; drawn at the Site's geocoded place instead. */
    | { by: 'site'; siteName: string };

/** Why something is not on the map. */
export type UnplacedReason = 'locating' | 'noLocation';

/** Its Site's place names, broadest first; empty when unknown. */
type Located = { location: LocationLevel[] };

export type PlacedDevice = DeviceRow &
    Located & {
        position: Point;
        placement: Placement;
    };
export type UnplacedDevice = DeviceRow & { reason: UnplacedReason };
export type PlacedSession = Dashboard['specimenPoints']['placed'][number] &
    Located & {
        placement: Placement;
    };
export type UnplacedSession =
    Dashboard['specimenPoints']['unplaced'][number] & {
        reason: UnplacedReason;
    };

type SiteState = {
    locations: SiteLocations['locations'];
    pending: Set<number>;
};

type SiteFallback =
    { reason: UnplacedReason } | { position: Point; placement: Placement };

function siteFallback(siteId: number | null, sites: SiteState): SiteFallback {
    if (siteId === null) return { reason: 'noLocation' };
    if (sites.pending.has(siteId) || !(siteId in sites.locations)) {
        return { reason: 'locating' };
    }
    const location = sites.locations[siteId];
    return location
        ? {
              position: {
                  latitude: location.latitude,
                  longitude: location.longitude,
              },
              placement: { by: 'site', siteName: location.query },
          }
        : { reason: 'noLocation' };
}

// GPS always wins; the Site is only a fallback for what GPS cannot place.
export function placeBySite(dashboard: Dashboard, sites: SiteState) {
    const locationOf = (siteId: number | null): LocationLevel[] =>
        (siteId !== null && dashboard.sitePaths[siteId]) || [];
    const devices = {
        placed: [] as PlacedDevice[],
        unplaced: [] as UnplacedDevice[],
    };
    for (const device of dashboard.devices) {
        if (device.status === 'NEVER_USED') continue;
        if (device.position) {
            devices.placed.push({
                ...device,
                position: device.position,
                placement: { by: 'gps' },
                location: locationOf(device.siteId),
            });
            continue;
        }
        const fallback = siteFallback(device.siteId, sites);
        if ('reason' in fallback)
            devices.unplaced.push({ ...device, reason: fallback.reason });
        else
            devices.placed.push({
                ...device,
                ...fallback,
                location: locationOf(device.siteId),
            });
    }

    const sessions = {
        placed: dashboard.specimenPoints.placed.map((point): PlacedSession => ({
            ...point,
            placement: { by: 'gps' },
            location: locationOf(point.siteId),
        })),
        unplaced: [] as UnplacedSession[],
    };
    for (const session of dashboard.specimenPoints.unplaced) {
        const fallback = siteFallback(session.siteId, sites);
        if ('reason' in fallback) {
            sessions.unplaced.push({ ...session, reason: fallback.reason });
        } else {
            sessions.placed.push({
                ...session,
                latitude: fallback.position.latitude,
                longitude: fallback.position.longitude,
                placement: fallback.placement,
                location: locationOf(session.siteId),
            });
        }
    }
    return { devices, sessions };
}

/** Sites the map needs geocoded: those of devices and Sessions without GPS. */
export function sitesToLocate(dashboard: Dashboard): number[] {
    const ids = new Set<number>();
    for (const device of dashboard.devices) {
        if (
            device.status !== 'NEVER_USED' &&
            !device.position &&
            device.siteId !== null
        ) {
            ids.add(device.siteId);
        }
    }
    for (const session of dashboard.specimenPoints.unplaced)
        ids.add(session.siteId);
    return [...ids].sort((a, b) => a - b);
}
