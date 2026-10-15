import type { ShadedAreaRef } from './build-specimen-shading';
import type { MultiPolygon } from './match-coverage-boundaries';
import type { CoverageStatus } from './parse-coverage-sheets';
import type { CoverageUnitRef } from './search-map';

type Unit = CoverageUnitRef & { status: CoverageStatus };

export type PlaceOption = {
    key: string;
    name: string;
    /** The country a place lies in; null for a country itself. */
    country: string | null;
    shape: MultiPolygon;
} & (
    | { kind: 'country' }
    | { kind: 'area'; area: ShadedAreaRef }
    | { kind: 'unit'; unit: Unit }
);

const areaKey = (area: ShadedAreaRef) =>
    `area:${area.programId}:${area.depth}:${area.name}`;
const unitKey = (unit: CoverageUnitRef) =>
    `unit:${unit.programId}:${unit.unit}`;

/** The picker's key for a map selection; null when it names no place. */
export function selectedPlaceKey(
    selection: {
        country?: string;
        area?: ShadedAreaRef;
        unit?: CoverageUnitRef;
    } | null,
): string | null {
    if (selection?.unit) return unitKey(selection.unit);
    if (selection?.area) return areaKey(selection.area);
    if (selection?.country) return `country:${selection.country}`;
    return null;
}

/**
 * Every place drawn on the map, for the panel's picker: countries, then
 * shaded areas, then Coverage Units, each alphabetical.
 */
export function buildPlaceOptions({
    outlines,
    areas,
    units,
    countryOf,
}: {
    outlines: readonly { country: string; geometry: MultiPolygon }[];
    areas: readonly (ShadedAreaRef & { geometry: MultiPolygon })[];
    units: readonly (Unit & { geometry: MultiPolygon })[];
    countryOf: ReadonlyMap<number, string>;
}): PlaceOption[] {
    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name);
    return [
        ...outlines
            .map(o => ({
                kind: 'country' as const,
                key: `country:${o.country}`,
                name: o.country,
                country: null,
                shape: o.geometry,
            }))
            .sort(byName),
        ...areas
            .map(({ programId, name, depth, geometry }) => ({
                kind: 'area' as const,
                key: areaKey({ programId, name, depth }),
                name,
                country: countryOf.get(programId) ?? null,
                shape: geometry,
                area: { programId, name, depth },
            }))
            .sort(byName),
        ...units
            .map(({ programId, unit, status, geometry }) => ({
                kind: 'unit' as const,
                key: unitKey({ programId, unit }),
                name: unit,
                country: countryOf.get(programId) ?? null,
                shape: geometry,
                unit: { programId, unit, status },
            }))
            .sort(byName),
    ];
}
