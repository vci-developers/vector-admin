import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import {
    multiPolygonSchema,
    type Boundary,
    type MultiPolygon,
} from './match-coverage-boundaries';
import { normalizePlaceName } from './parse-coverage-sheets';

export type ProgressDistrictFill = {
    district: ProgressDistrict;
    geometry: MultiPolygon;
};

/** Only source-reviewed alternative names may be supplied by the local atlas. */
export type ProgressAreaBoundary = Boundary & {
    aliases?: readonly string[];
    sourceId?: string;
};

export type ProgressAreaFeatureCollection = {
    country: string;
    features: readonly {
        properties: {
            name: string;
            aliases?: readonly string[];
            sourceId?: string;
        };
        geometry: unknown;
    }[];
};

export function progressAreaBoundaries(
    collection: ProgressAreaFeatureCollection,
): ProgressAreaBoundary[] {
    return collection.features.map(feature => ({
        name: feature.properties.name,
        aliases: feature.properties.aliases,
        sourceId: feature.properties.sourceId,
        geometry: multiPolygonSchema.parse(feature.geometry),
    }));
}

const normalize = (name: string) =>
    normalizePlaceName(name.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''));

/** Full country/name or reviewed aliases only; ambiguous names never choose a shape. */
export function matchProgressDistrictBoundaries(
    districts: readonly ProgressDistrict[],
    boundariesByCountry: ReadonlyMap<string, readonly ProgressAreaBoundary[]>,
): { fills: ProgressDistrictFill[]; unmatched: ProgressDistrict[] } {
    const indexes = new Map<string, Map<string, MultiPolygon | null>>();
    for (const [country, boundaries] of boundariesByCountry) {
        const countryKey = normalize(country);
        if (!countryKey) continue;
        const index =
            indexes.get(countryKey) ?? new Map<string, MultiPolygon | null>();
        for (const boundary of boundaries) {
            const names = new Set(
                [boundary.name, ...(boundary.aliases ?? [])].map(normalize),
            );
            for (const name of names) {
                if (!name) continue;
                // A duplicate stays ambiguous even when a later row is unique.
                index.set(name, index.has(name) ? null : boundary.geometry);
            }
        }
        indexes.set(countryKey, index);
    }

    const fills: ProgressDistrictFill[] = [];
    const unmatched: ProgressDistrict[] = [];
    for (const district of districts) {
        const name = normalize(district.name);
        const geometry =
            name && !district.key.endsWith(':unknown')
                ? indexes.get(normalize(district.country))?.get(name)
                : null;
        if (geometry) fills.push({ district, geometry });
        else unmatched.push(district);
    }
    return { fills, unmatched };
}
