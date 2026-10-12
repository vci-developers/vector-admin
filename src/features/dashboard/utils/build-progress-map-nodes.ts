import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import {
    mergeLocationCoverage,
    totalReportingLocations,
} from './progress-location-policy';

export type ProgressMapPosition = NonNullable<ProgressDistrict['position']>;
export type ProjectedMapPosition = { x: number; y: number };

/** Counts cover the located district records in sourceDistricts only. */
export type ProgressMapNode = {
    key: string;
    kind: 'district' | 'cluster' | 'country';
    country: string;
    districtKeys: string[];
    sourceDistricts: ProgressDistrict[];
    position: ProgressMapPosition;
    projected: ProjectedMapPosition;
    uniqueScans: number;
    coverageByProgram: ProgressDistrict['coverageByProgram'];
    reportingLocations: number | null;
};

/** Share country/detail visibility across markers, area labels, and polygon actions. */
export function progressMapDetailDistrictKeys(
    nodes: readonly ProgressMapNode[],
): ReadonlySet<string> {
    return new Set(
        nodes
            .filter(node => node.kind !== 'country')
            .flatMap(node => node.districtKeys),
    );
}

type MapNodeOptions = {
    districts: readonly ProgressDistrict[];
    zoom: number;
    project: (position: ProgressMapPosition) => ProjectedMapPosition;
    /** Centre-to-centre screen distance in pixels at the current zoom. */
    clusterDistance?: number;
    overviewZoom?: number;
    /** Compact footprints use clusters rather than country summaries above this zoom. */
    overviewMaxZoom?: number;
    /** Maximum projected width/height for a country's compact footprint. */
    overviewFootprint?: number;
};

const compareKeys = (a: { key: string }, b: { key: string }) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

const countryKey = (country: string) => country.trim().toLowerCase();

/**
 * Builds screen-space nodes without changing reporting data or displacing
 * real geography. Countries never merge. Missing-position district records
 * remain available to the caller's chart and totals, but are not map nodes.
 */
export function buildProgressMapNodes({
    districts,
    zoom,
    project,
    clusterDistance = 44,
    overviewZoom = 6,
    overviewMaxZoom = 7,
    overviewFootprint = 88,
}: MapNodeOptions): ProgressMapNode[] {
    const located = districts
        .filter(district => district.position !== null)
        .toSorted(compareKeys);
    const byCountry = new Map<string, ProgressDistrict[]>();
    for (const district of located) {
        const key = countryKey(district.country);
        const rows = byCountry.get(key) ?? [];
        rows.push(district);
        byCountry.set(key, rows);
    }

    function nodeOf(
        source: ProgressDistrict[],
        kind: ProgressMapNode['kind'],
    ): ProgressMapNode {
        const sourceDistricts = source.toSorted(compareKeys);
        const districtKeys = sourceDistricts.map(district => district.key);
        const uniqueScans = sourceDistricts.reduce(
            (total, district) => total + district.uniqueScans,
            0,
        );
        const coverageByProgram = mergeLocationCoverage(
            sourceDistricts.flatMap(district => district.coverageByProgram),
        );
        const reportingLocations = totalReportingLocations(coverageByProgram);
        const weights = uniqueScans > 0 ? uniqueScans : sourceDistricts.length;
        const referenceLongitude = sourceDistricts[0].position!.longitude;
        const position = sourceDistricts.reduce(
            (total, district) => {
                const weight = uniqueScans > 0 ? district.uniqueScans : 1;
                const point = district.position!;
                // Nearby points across the antimeridian must not average to zero.
                const longitudeOffset =
                    ((point.longitude - referenceLongitude + 540) % 360) - 180;
                total.latitude += (point.latitude * weight) / weights;
                total.longitude +=
                    ((referenceLongitude + longitudeOffset) * weight) / weights;
                return total;
            },
            { latitude: 0, longitude: 0 },
        );
        if (sourceDistricts.length === 1) {
            position.latitude = sourceDistricts[0].position!.latitude;
            position.longitude = sourceDistricts[0].position!.longitude;
        } else {
            position.longitude = ((position.longitude + 540) % 360) - 180;
        }
        return {
            key:
                kind === 'district'
                    ? sourceDistricts[0].key
                    : kind === 'country'
                      ? `country:${countryKey(sourceDistricts[0].country)}`
                      : `cluster:${JSON.stringify(districtKeys)}`,
            kind,
            country: sourceDistricts[0].country,
            districtKeys,
            sourceDistricts,
            position,
            projected: project(position),
            uniqueScans,
            coverageByProgram,
            reportingLocations,
        };
    }

    const result: ProgressMapNode[] = [];
    for (const rows of byCountry.values()) {
        let nodes = rows.map(district => nodeOf([district], 'district'));
        const xs = nodes.map(node => node.projected.x);
        const ys = nodes.map(node => node.projected.y);
        const footprint = Math.max(
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
        );
        if (
            zoom < overviewZoom ||
            (zoom < overviewMaxZoom &&
                nodes.length > 1 &&
                footprint <= overviewFootprint)
        ) {
            result.push(nodeOf(rows, 'country'));
            continue;
        }

        // Recompute centres after each merge: a new aggregate's centre can
        // otherwise overlap a node that did not touch its original members.
        for (;;) {
            let nearest: [number, number] | null = null;
            let distance = clusterDistance ** 2;
            for (let first = 0; first < nodes.length; first++) {
                for (let second = first + 1; second < nodes.length; second++) {
                    const a = nodes[first].projected;
                    const b = nodes[second].projected;
                    const candidate = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
                    if (
                        candidate <= distance &&
                        (nearest === null || candidate < distance)
                    ) {
                        nearest = [first, second];
                        distance = candidate;
                    }
                }
            }
            if (nearest === null) break;
            const [first, second] = nearest;
            const merged = nodeOf(
                [
                    ...nodes[first].sourceDistricts,
                    ...nodes[second].sourceDistricts,
                ],
                'cluster',
            );
            nodes = nodes.filter(
                (_, index) => index !== first && index !== second,
            );
            nodes.push(merged);
            nodes.sort(compareKeys);
        }
        result.push(...nodes);
    }
    return result.sort(compareKeys);
}
