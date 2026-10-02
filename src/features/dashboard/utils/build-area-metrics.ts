import type { Session } from '@/api/session/validation/session-schema';
import {
    countSessions,
    sessionsInPeriod,
    withRatios,
    type PeriodMetrics,
    type Period,
    type ProgramData,
} from './build-period-metrics';
import { programTimeZone } from './month-key';
import { siteLocationPath } from './site-location-path';

/** A Program's top-level place, e.g. a District in Uganda or a Region. */
export type AreaMetrics = {
    programId: number;
    /** e.g. "District"; null for Sessions whose Site has no place. */
    level: string | null;
    name: string | null;
    /** Users and logins belong to no Site, so they are always null here. */
    metrics: PeriodMetrics;
};

/**
 * The period's metrics per top-level area for one Program, alphabetically,
 * Sessions whose Site has no place last. A Device that moved between areas is
 * an Active Device in each, so areas' Active Devices can add up to more than
 * the Program's; every other count adds up.
 */
export function buildAreaMetrics(
    programData: ProgramData,
    period: Period,
): AreaMetrics[] {
    const { program, snapshot } = programData;
    const sites = new Map(snapshot.sites.map(site => [site.siteId, site]));
    const areaOf = (session: Session) => {
        const site = sites.get(session.siteId);
        return (site && siteLocationPath(site)[0]) ?? null;
    };
    const byArea = Map.groupBy(
        sessionsInPeriod(
            snapshot.sessions,
            period,
            programTimeZone(snapshot.collectionCycles),
        ),
        session => areaOf(session)?.name ?? null,
    );

    return [...byArea]
        .map(([name, sessions]) => ({
            programId: program.programId,
            level: areaOf(sessions[0])?.level ?? null,
            name,
            metrics: withRatios(countSessions(sessions, programData), false),
        }))
        .sort((a, b) =>
            a.name === null
                ? 1
                : b.name === null
                  ? -1
                  : a.name.localeCompare(b.name),
        );
}
