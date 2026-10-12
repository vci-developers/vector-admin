import { z } from 'zod';
import {
    normalizePlaceName,
    type CoverageStatus,
    type CoverageUnit,
} from './parse-coverage-sheets';

/** GeoJSON MultiPolygon; positions are [longitude, latitude]. */
export const multiPolygonSchema = z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
});

export type MultiPolygon = z.infer<typeof multiPolygonSchema>;

export type Boundary = { name: string; geometry: MultiPolygon };

export type CoverageFill = {
    programId: number;
    unit: string;
    /** The matched shape's own name, e.g. "Baringo" for the site "Barpello". */
    area: string;
    status: CoverageStatus;
    geometry: MultiPolygon;
};

/** A workbook row with no shape: drawn nowhere, listed under the map. */
export type UnmatchedUnit = {
    programId: number;
    unit: string;
    /** The name that was looked up: `boundary` if given, else `unit`. */
    lookedUp: string;
};

/**
 * Joins Coverage Units to their Program Country's boundaries by name,
 * ignoring case, spaces and hyphens. A unit's `boundary` column, when set,
 * names the shape instead of `unit` (e.g. "Arua-periurban" drawn as "Arua").
 * A unit with no shape of its own (a site) falls back to its `region`.
 */
export function matchCoverageBoundaries(
    units: CoverageUnit[],
    boundariesByProgram: Map<number, Boundary[]>,
): { fills: CoverageFill[]; unmatched: UnmatchedUnit[] } {
    const indexes = new Map(
        [...boundariesByProgram].map(([programId, boundaries]) => [
            programId,
            new Map(boundaries.map(b => [normalizePlaceName(b.name), b])),
        ]),
    );
    const fills: CoverageFill[] = [];
    const unmatched: UnmatchedUnit[] = [];
    for (const { programId, unit, status, boundary, region } of units) {
        const lookedUp = boundary ?? unit;
        const index = indexes.get(programId);
        const match =
            index?.get(normalizePlaceName(lookedUp)) ??
            (region ? index?.get(normalizePlaceName(region)) : undefined);
        if (match)
            fills.push({
                programId,
                unit,
                area: match.name,
                status,
                geometry: match.geometry,
            });
        else unmatched.push({ programId, unit, lookedUp });
    }
    return { fills, unmatched };
}
