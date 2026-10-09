/**
 * One Area's share of a Program's monthly figure, spread over the Program's
 * planned Areas (Uganda Sep: 66 / 11 Districts = 6). Used for the device cap
 * and each Area's expected users. null without a figure or planned Areas.
 */
export function areaShare(
    total: number | undefined,
    plannedAreas: number,
): number | null {
    if (total === undefined || plannedAreas === 0) return null;
    return Math.round(total / plannedAreas);
}

type AreaDevice = {
    deviceId: number;
    programId: number;
    status: string;
    lastSubmittedAt: number | null;
};

/**
 * Keeps each Area's active devices to its Program's cap, most recently used
 * first, so a phone re-registered under new ids (Karenga: 17 devices for 5
 * collectors) never shows more devices than were planned. Other devices pass
 * through unchanged.
 */
export function capAreaDevices<D extends AreaDevice>(
    devices: D[],
    areaOf: (device: D) => string,
    capOf: (programId: number) => number | null,
): D[] {
    const kept = new Set<D>();
    const byArea = new Map<string, D[]>();
    for (const device of devices) {
        if (device.status !== 'ACTIVE' || capOf(device.programId) === null) {
            kept.add(device);
            continue;
        }
        const key = `${device.programId}:${areaOf(device)}`;
        byArea.set(key, [...(byArea.get(key) ?? []), device]);
    }
    for (const group of byArea.values()) {
        const cap = capOf(group[0].programId) ?? group.length;
        group
            .toSorted(
                (a, b) => (b.lastSubmittedAt ?? 0) - (a.lastSubmittedAt ?? 0),
            )
            .slice(0, cap)
            .forEach(device => kept.add(device));
    }
    return devices.filter(device => kept.has(device));
}
