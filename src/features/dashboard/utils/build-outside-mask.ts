import type { MultiPolygon } from './match-coverage-boundaries';

type Ring = [number, number][];

// The whole map, wound counter-clockwise like a GeoJSON outer ring.
const WORLD: Ring = [
    [-180, -90],
    [180, -90],
    [180, 90],
    [-180, 90],
    [-180, -90],
];

/**
 * One polygon covering everything outside the given countries: the world,
 * with each country's land cut out as a hole. Shading it fades the rest of
 * the map so the selected countries stand out. Lakes inside a country stay
 * unshaded, since only each piece's outer ring is cut.
 */
export function buildOutsideMask(countries: MultiPolygon[]): MultiPolygon {
    const holes = countries.flatMap(country =>
        country.coordinates.flatMap(polygon => polygon.slice(0, 1)),
    );
    return { type: 'MultiPolygon', coordinates: [[WORLD, ...holes]] };
}
