import 'server-only';

import {
    multiPolygonSchema,
    type Boundary,
    type MultiPolygon,
} from '@/features/dashboard/utils/match-coverage-boundaries';
import { z } from 'zod';
import countries from './countries.json';
import uganda from './uganda.json';

// Written by scripts/fetch-boundaries.mjs; one file per Program Country.
const boundaryFileSchema = z.object({
    country: z.string(),
    features: z.array(
        z.object({
            properties: z.object({ name: z.string() }),
            geometry: multiPolygonSchema,
        }),
    ),
});

let byCountry: Map<string, Boundary[]> | undefined;

/** The committed boundaries for a Program Country; empty when there are none. */
export function boundariesForCountry(country: string): Boundary[] {
    byCountry ??= new Map(
        [uganda].map(file => {
            const { country, features } = boundaryFileSchema.parse(file);
            return [
                country,
                features.map(f => ({
                    name: f.properties.name,
                    geometry: f.geometry,
                })),
            ];
        }),
    );
    return byCountry.get(country) ?? [];
}

// Written by scripts/fetch-country-outlines.mjs.
const outlineFileSchema = z.object({
    outlines: z.array(
        z.object({ country: z.string(), geometry: multiPolygonSchema }),
    ),
});

let outlines: Map<string, MultiPolygon> | undefined;

/** A Program Country's land outline; null when it has none committed. */
export function countryOutline(country: string): MultiPolygon | null {
    outlines ??= new Map(
        outlineFileSchema
            .parse(countries)
            .outlines.map(o => [o.country, o.geometry]),
    );
    return outlines.get(country) ?? null;
}
