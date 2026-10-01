import type { Site } from '@/api/site/validation/site-schema';
import {
    addCounts,
    addSessionCounts,
    emptyCounts,
    sessionsInPeriod,
    specimensBySession,
    withRatios,
    type PeriodCounts,
    type PeriodMetrics,
    type Period,
    type ProgramData,
} from './build-period-metrics';
import { programTimeZone } from './month-key';
import { isLegacySite } from './site-location-query';

export type LocationLevel = { level: string; name: string };

/**
 * One place in a Program's location hierarchy. Nodes are keyed by their path
 * of names, so Sites that share a District (or Region) share its node.
 */
export type LocationNode = {
    key: string;
    parentKey: string | null;
    programId: number;
    /** e.g. "District"; null for Sessions whose Site is unknown. */
    level: string | null;
    name: string | null;
    /** Users and logins belong to no Site, so they are always null here. */
    metrics: PeriodMetrics;
};

// Legacy Sites have fixed fields, broadest first.
const LEGACY_LEVELS = [
    ['district', 'District'],
    ['subCounty', 'Sub-county'],
    ['healthCenter', 'Health Centre'],
    ['parish', 'Parish'],
    ['villageName', 'Village'],
    ['houseNumber', 'House'],
] as const;

/** The Site's place names, broadest first, skipping empty levels. */
export function siteLocationPath(site: Site): LocationLevel[] {
    const levels: [string, string | null | undefined][] = isLegacySite(site)
        ? LEGACY_LEVELS.map(([field, level]) => [level, site[field]])
        : Object.entries(site.locationHierarchy);
    // Legacy forms filled unused levels with "N/A"; they add no information.
    return levels.flatMap(([level, name]) => {
        const trimmed = name?.trim();
        return trimmed && trimmed.toUpperCase() !== 'N/A'
            ? [{ level, name: trimmed }]
            : [];
    });
}

/**
 * The period's metrics per location for one Program, from the Counted
 * Sessions at Sites at or below each place. A Device that moved between Sites
 * is an Active Device under each, so children's Active Devices can add up to
 * more than their parent's; every other count adds up.
 */
export function buildLocationTree(
    { program, snapshot }: ProgramData,
    period: Period,
): LocationNode[] {
    const { programId, country } = program;
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const paths = new Map(
        snapshot.sites.map(site => [site.siteId, siteLocationPath(site)]),
    );
    const specimens = specimensBySession(snapshot.specimens);
    const nodes = new Map<
        string,
        Omit<LocationNode, 'metrics'> & {
            counts: PeriodCounts;
            devices: Set<number>;
        }
    >();

    function addTo(
        key: string,
        node: Omit<LocationNode, 'metrics' | 'key'>,
        deviceId: number,
        sessionCounts: PeriodCounts,
    ) {
        let entry = nodes.get(key);
        if (!entry) {
            entry = { key, ...node, counts: emptyCounts(), devices: new Set() };
            nodes.set(key, entry);
        }
        entry.devices.add(deviceId);
        addCounts(entry.counts, sessionCounts);
    }

    for (const session of sessionsInPeriod(
        snapshot.sessions,
        period,
        timeZone,
    )) {
        const sessionCounts = emptyCounts();
        addSessionCounts(
            sessionCounts,
            session,
            specimens.get(session.sessionId) ?? [],
            country,
        );

        const path = paths.get(session.siteId) ?? [];
        if (path.length === 0) {
            addTo(
                `${programId}:unknown`,
                { parentKey: null, programId, level: null, name: null },
                session.deviceId,
                sessionCounts,
            );
            continue;
        }

        let parentKey: string | null = null;
        for (const { level, name } of path) {
            const key: string = `${parentKey ?? programId}/${encodeURIComponent(name)}`;
            addTo(
                key,
                { parentKey, programId, level, name },
                session.deviceId,
                sessionCounts,
            );
            parentKey = key;
        }
    }

    return [...nodes.values()]
        .map(({ counts, devices, ...node }) => ({
            ...node,
            metrics: withRatios(
                { ...counts, activeDevices: devices.size },
                false,
            ),
        }))
        .sort(
            (a, b) =>
                b.metrics.activeDevices - a.metrics.activeDevices ||
                (a.name ?? '').localeCompare(b.name ?? ''),
        );
}
