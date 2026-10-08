import { areaKey } from './build-area-marks';
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

/**
 * Each Program's figures for one month, framed as the tiles frame them: every
 * Session the Session filter kept, whatever the map filters show, placed on
 * the map or not, never pooled across Programs. With `areas` (keys from
 * `areaKey`), only Sessions in those Areas count.
 */
export function tileFiguresByProgram(
    sessions: CountedSession[],
    month: MonthKey,
    areas: Set<string> | null = null,
): Map<number, TileFigures> {
    const byProgram = new Map<number, CountedSession[]>();
    for (const session of sessions) {
        if (session.month !== month) continue;
        const area = areaKey(
            session.programId,
            session.location[0]?.name ?? null,
        );
        if (areas && !areas.has(area)) continue;
        const list = byProgram.get(session.programId) ?? [];
        list.push(session);
        byProgram.set(session.programId, list);
    }
    return new Map(
        [...byProgram].map(([programId, list]) => [
            programId,
            {
                users: new Set(list.flatMap(s => s.collectorIds)).size,
                ...countSentinelSites(list),
            },
        ]),
    );
}
