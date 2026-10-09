import { areaKey } from './build-area-marks';
import { areaShare } from './cap-area-devices';
import { countSentinelSites } from './count-sentinel-sites';
import type { MonthKey } from './month-key';
import type { LocationLevel } from './site-location-path';

type CountedSession = {
    programId: number;
    siteId: number;
    month: MonthKey;
    collectorIds: number[];
    /** The Site's place names, broadest first; empty when unknown. */
    location: LocationLevel[];
};

export type TileFigures = {
    users: number;
    sentinelSites: number;
    /** Where Sites are houses (Uganda); 0 elsewhere. */
    houses: number;
};

/** One line of the map panel's figures: a Program, or one of its Areas. */
export type PanelFigureRow = {
    key: string;
    programId: number;
    /** The Area's name; null for a whole-Program line. */
    area: string | null;
    figures: TileFigures;
    /** Expected users for the line; null where the workbook has none. */
    expected: number | null;
    /** Active devices in the period (as the map's badges count them). */
    devices: number;
    /** Planned devices for the line; null where the workbook has none. */
    plannedDevices: number | null;
    /** Planned sentinel sites for the line; null where none are known. */
    plannedSentinelSites: number | null;
};

/** Active devices in one Area over the period, as the server counts them. */
type AreaDeviceCount = { programId: number; area: string; count: number };

/** One Area's planned devices, where a Program plans per Area (Uganda). */
type AreaDevicePlan = { programId: number; area: string; planned: number };

/**
 * The map panel's lines for one month, so they read against the plan (Uganda:
 * 11 Districts × 6 VHTs). The whole map: one line per Program beside its
 * expected users. A selection: one line per selected Area, never pooled even
 * when the map merged neighbouring marks, beside its share of the expected
 * users (spread over the Program's planned Areas).
 */
export function panelFigureRows(
    sessions: CountedSession[],
    deviceCounts: AreaDeviceCount[],
    month: MonthKey,
    areas: Set<string> | null,
    plan: {
        expectedUsers: (programId: number) => number | undefined;
        devices: (programId: number) => number | undefined;
        areas: (programId: number) => number;
        /** Each Area's planned sentinel sites, where known. */
        sentinelSites: (programId: number) => number | null;
        /**
         * Per-Area planned devices; a Program with any reads against these
         * (summed for its line) instead of its share of `devices`.
         */
        areaDevices: AreaDevicePlan[];
    },
): PanelFigureRow[] {
    const inMonth = sessions.filter(session => session.month === month);
    const keyOf = (session: CountedSession) =>
        areaKey(session.programId, session.location[0]?.name ?? null);
    const sumDevices = (rows: AreaDeviceCount[]) =>
        rows.reduce((sum, row) => sum + row.count, 0);
    const areaPlansOf = (programId: number) =>
        plan.areaDevices.filter(row => row.programId === programId);
    const programPlannedDevices = (programId: number) => {
        const plans = areaPlansOf(programId);
        return plans.length > 0
            ? plans.reduce((sum, row) => sum + row.planned, 0)
            : (plan.devices(programId) ?? null);
    };
    const areaPlannedDevices = (programId: number, key: string) => {
        const plans = areaPlansOf(programId);
        return plans.length > 0
            ? (plans.find(row => areaKey(row.programId, row.area) === key)
                  ?.planned ?? null)
            : areaShare(plan.devices(programId), plan.areas(programId));
    };
    const programSentinelSites = (programId: number) => {
        const perArea = plan.sentinelSites(programId);
        const areas = plan.areas(programId);
        return perArea === null || areas === 0 ? null : perArea * areas;
    };
    const figuresOf = (list: CountedSession[]): TileFigures => ({
        users: new Set(list.flatMap(s => s.collectorIds)).size,
        ...countSentinelSites(list),
    });

    if (!areas) {
        return [...Map.groupBy(inMonth, s => s.programId)].map(
            ([programId, list]) => ({
                key: String(programId),
                programId,
                area: null,
                figures: figuresOf(list),
                expected: plan.expectedUsers(programId) ?? null,
                devices: sumDevices(
                    deviceCounts.filter(row => row.programId === programId),
                ),
                plannedDevices: programPlannedDevices(programId),
                plannedSentinelSites: programSentinelSites(programId),
            }),
        );
    }

    const byArea = Map.groupBy(inMonth, keyOf);
    return [...areas]
        .map(key => {
            const list = byArea.get(key) ?? [];
            const programId = Number(key.slice(0, key.indexOf(':')));
            return {
                key,
                programId,
                area:
                    list[0]?.location[0]?.name ??
                    key.slice(key.indexOf(':') + 1),
                figures: figuresOf(list),
                expected: areaShare(
                    plan.expectedUsers(programId),
                    plan.areas(programId),
                ),
                devices: sumDevices(
                    deviceCounts.filter(
                        row => areaKey(row.programId, row.area) === key,
                    ),
                ),
                plannedDevices: areaPlannedDevices(programId, key),
                plannedSentinelSites: plan.sentinelSites(programId),
            };
        })
        .sort((a, b) => (a.area ?? '').localeCompare(b.area ?? ''));
}
