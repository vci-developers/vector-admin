import { collectorKeys } from './count-active-collectors';
import type { LocationLevel } from './site-location-path';

/**
 * Uganda's new rollout Districts give each VHT their own phone, two per
 * village; elsewhere a village's VHTs share one phone (Uganda team,
 * 2026-10-09). Hard-coded for Uganda until the workbook carries it.
 */
const PHONE_PER_VHT_DISTRICTS = new Set(['madi-okollo', 'oyam', 'karenga']);
const PHONES_PER_VILLAGE = 2;

/** Each Uganda District's planned sentinel sites (villages). */
export const UGANDA_SENTINEL_SITES_PER_DISTRICT = 3;

/**
 * A Uganda District's planned phones by the same rule: one per village, or
 * two in a phone-per-VHT District (Sep: 8 × 3 + 3 × 6 = 42). The map and
 * panel read against this, not the workbook's Projected Devices.
 */
export function plannedVillageDevices(district: string): number {
    return (
        UGANDA_SENTINEL_SITES_PER_DISTRICT *
        (PHONE_PER_VHT_DISTRICTS.has(district.toLowerCase())
            ? PHONES_PER_VILLAGE
            : 1)
    );
}

type VillageSession = { siteId: number; collectorName: string };

/**
 * Uganda's active devices per District, from places and people rather than
 * device ids (re-registered phones get new ids): a village with any data is
 * one active device, or in a phone-per-VHT District one per person named, up
 * to two. A village is the Site's path above the House.
 */
export function countVillageDevices(
    sessions: VillageSession[],
    sitePaths: Record<number, LocationLevel[]>,
): { area: string; count: number }[] {
    const villages = new Map<string, { area: string; people: Set<string> }>();
    for (const session of sessions) {
        const path = (sitePaths[session.siteId] ?? []).filter(
            level => level.level !== 'House',
        );
        const key = path.map(level => level.name.toLowerCase()).join(' > ');
        const village = villages.get(key) ?? {
            area: path[0]?.name ?? '',
            people: new Set<string>(),
        };
        collectorKeys(session.collectorName).forEach(person =>
            village.people.add(person),
        );
        villages.set(key, village);
    }

    const counts = new Map<string, number>();
    for (const { area, people } of villages.values()) {
        const devices = PHONE_PER_VHT_DISTRICTS.has(area.toLowerCase())
            ? Math.min(PHONES_PER_VILLAGE, Math.max(1, people.size))
            : 1;
        counts.set(area, (counts.get(area) ?? 0) + devices);
    }
    return [...counts].map(([area, count]) => ({ area, count }));
}
