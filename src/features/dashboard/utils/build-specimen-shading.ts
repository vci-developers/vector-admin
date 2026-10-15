import type { AreaMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import type { MultiPolygon } from './match-coverage-boundaries';
import type { ProgressAreaBoundary } from './match-progress-district-boundaries';
import { normalizePlaceName } from './parse-coverage-sheets';
import { progressScanFillColor } from './progress-map-colors';

/** A shaded area: its Program, name, and the Site-path level it names. */
export type ShadedAreaRef = {
    programId: number;
    name: string;
    /** 0 for the top-level area, 1 for the level below. */
    depth: number;
    /** A hex cell's Sessions; areas find theirs by name. */
    sessionIds?: number[];
};

export type SpecimenShade = ShadedAreaRef & {
    key: string;
    specimens: number;
    fillColor: string;
    geometry: MultiPolygon;
};

/** A Session's specimens and Site, for counting below the top-level area. */
export type SessionSpecimens = {
    programId: number;
    siteId: number;
    specimenCount: number;
};

type Candidate = ShadedAreaRef & { specimens: number };

const normalize = (name: string) =>
    normalizePlaceName(name.normalize('NFKD').replace(/[̀-ͯ]/g, ''));

/**
 * Areas with a known boundary, shaded green by unique specimens on the
 * Stakeholder map's scale (darker = more), one scale across them all. Matches
 * like the Stakeholder map: the name or a reviewed alias in the Program's
 * country; an ambiguous name never picks a shape. A Program none of whose
 * top-level areas have a boundary (Ghana: Regions, but District boundaries) is
 * counted one level down its Sites' paths instead.
 */
export function buildSpecimenShading({
    areas,
    sessions,
    sitePaths,
    countryOf,
    boundariesByCountry,
}: {
    areas: readonly AreaMetricsDto[];
    sessions: readonly SessionSpecimens[];
    sitePaths: Readonly<Record<string, readonly { name: string }[]>>;
    countryOf: ReadonlyMap<number, string>;
    boundariesByCountry: ReadonlyMap<string, readonly ProgressAreaBoundary[]>;
}): SpecimenShade[] {
    const indexes = new Map<string, Map<string, MultiPolygon | null>>();
    for (const [country, boundaries] of boundariesByCountry) {
        const index = new Map<string, MultiPolygon | null>();
        for (const boundary of boundaries)
            for (const name of new Set(
                [boundary.name, ...(boundary.aliases ?? [])].map(normalize),
            ))
                if (name)
                    index.set(name, index.has(name) ? null : boundary.geometry);
        indexes.set(normalize(country), index);
    }
    const shapeOf = ({ programId, name }: Candidate) => {
        const country = countryOf.get(programId);
        return country
            ? indexes.get(normalize(country))?.get(normalize(name))
            : undefined;
    };

    const topLevel = Map.groupBy(
        areas.flatMap(area =>
            area.name
                ? [
                      {
                          programId: area.programId,
                          name: area.name,
                          depth: 0,
                          specimens: area.metrics.uniqueSpecimens,
                      },
                  ]
                : [],
        ),
        candidate => candidate.programId,
    );
    const candidates = [...topLevel].flatMap(([programId, programAreas]) => {
        if (programAreas.some(shapeOf)) return programAreas;
        const below = new Map<string, number>();
        for (const session of sessions) {
            if (session.programId !== programId) continue;
            const name = sitePaths[session.siteId]?.[1]?.name;
            if (name)
                below.set(name, (below.get(name) ?? 0) + session.specimenCount);
        }
        return [...below].map(([name, specimens]) => ({
            programId,
            name,
            depth: 1,
            specimens,
        }));
    });

    const matched = candidates.flatMap(candidate => {
        const geometry = shapeOf(candidate);
        return geometry ? [{ ...candidate, geometry }] : [];
    });
    const maximum = Math.max(0, ...matched.map(m => m.specimens));
    return matched.map(({ programId, name, depth, specimens, geometry }) => ({
        key: `${programId}/${name}`,
        programId,
        name,
        depth,
        specimens,
        fillColor: progressScanFillColor(specimens, maximum),
        geometry,
    }));
}

/** The Sessions inside a shaded area: their Site path names it at its level. */
export function areaSessionIds(
    area: ShadedAreaRef,
    sessions: readonly {
        sessionId: number;
        programId: number;
        location: readonly { name: string }[];
    }[],
): number[] {
    const name = normalize(area.name);
    return sessions
        .filter(
            session =>
                session.programId === area.programId &&
                session.location[area.depth] !== undefined &&
                normalize(session.location[area.depth].name) === name,
        )
        .map(session => session.sessionId);
}
