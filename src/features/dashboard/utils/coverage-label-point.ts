import type { MultiPolygon } from './match-coverage-boundaries';

type Ring = [number, number][];

/** Signed area and centroid of a ring of [longitude, latitude] positions. */
function ringCentroid(ring: Ring) {
    let area = 0;
    let x = 0;
    let y = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x0, y0] = ring[j];
        const [x1, y1] = ring[i];
        const cross = x0 * y1 - x1 * y0;
        area += cross;
        x += (x0 + x1) * cross;
        y += (y0 + y1) * cross;
    }
    area /= 2;
    return area === 0
        ? null
        : { area: Math.abs(area), lon: x / (6 * area), lat: y / (6 * area) };
}

/**
 * Where a unit's name is drawn, as [latitude, longitude]: the centroid of its
 * largest piece, so islands and exclaves don't pull the label off the land.
 * `area` (in square degrees) ranks labels when they collide.
 */
export function coverageLabelPoint(
    geometry: MultiPolygon,
): { at: [number, number]; area: number } | null {
    let best: { area: number; lon: number; lat: number } | null = null;
    for (const [outer] of geometry.coordinates) {
        const centroid = outer ? ringCentroid(outer) : null;
        if (centroid && (!best || centroid.area > best.area)) best = centroid;
    }
    return best ? { at: [best.lat, best.lon], area: best.area } : null;
}
