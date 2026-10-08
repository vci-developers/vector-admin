// Shared by the boundary scripts: OSM relations to GeoJSON polygons, and
// simplification. Positions are [longitude, latitude].

const key = ([lon, lat]) => `${lon},${lat}`;

/** Joins ways end to end into closed rings. */
function assembleRings(ways) {
    const pending = ways.map(way => [...way]);
    const rings = [];
    while (pending.length > 0) {
        const ring = pending.shift();
        while (key(ring[0]) !== key(ring.at(-1))) {
            const end = key(ring.at(-1));
            const next = pending.findIndex(
                way => key(way[0]) === end || key(way.at(-1)) === end,
            );
            if (next === -1) break; // unclosed: dropped below
            const [way] = pending.splice(next, 1);
            ring.push(...(key(way[0]) === end ? way : way.reverse()).slice(1));
        }
        if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1)))
            rings.push(ring);
    }
    return rings;
}

function inside([x, y], ring) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            hit = !hit;
    }
    return hit;
}

/**
 * An Overpass relation (`out geom`) as MultiPolygon coordinates, each inner
 * ring under the outer it sits in; null when no outer ring closes.
 */
export function relationPolygons(relation) {
    const ways = role =>
        relation.members
            .filter(m => m.type === 'way' && m.role === role && m.geometry)
            .map(m => m.geometry.map(({ lon, lat }) => [lon, lat]));
    const outers = assembleRings([...ways('outer'), ...ways('')]);
    const inners = assembleRings(ways('inner'));
    if (outers.length === 0) return null;
    const polygons = outers.map(outer => [outer]);
    for (const inner of inners) {
        const owner = polygons.find(([outer]) => inside(inner[0], outer));
        owner?.push(inner);
    }
    return polygons;
}

/** Douglas–Peucker to `tolerance` degrees, keeping the ring closed. */
export function simplify(points, tolerance) {
    if (points.length <= 4) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [first, last] = stack.pop();
        const [ax, ay] = points[first];
        const [bx, by] = points[last];
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.hypot(dx, dy);
        let worst = -1;
        let index = -1;
        for (let i = first + 1; i < last; i++) {
            const [px, py] = points[i];
            const distance =
                length === 0
                    ? Math.hypot(px - ax, py - ay)
                    : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
            if (distance > worst) [worst, index] = [distance, i];
        }
        if (worst > tolerance) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }
    const kept = points.filter((_, i) => keep[i]);
    return kept.length >= 4 ? kept : points;
}

export const round = ([lon, lat]) => [+lon.toFixed(4), +lat.toFixed(4)];
