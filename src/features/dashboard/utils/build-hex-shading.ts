import type { SpecimenShade } from './build-specimen-shading';
import { progressScanFillColor } from './progress-map-colors';
import { sharedLocationPath } from './shared-location-path';
import type { LocationLevel } from './site-location-path';

/** Centre to corner, in Web Mercator metres (about ground metres near the equator). */
export const HEX_SIZE_METRES = 8000;

const EARTH_RADIUS = 6378137;
const RAD = Math.PI / 180;

type HexSession = {
    sessionId: number;
    programId: number;
    latitude: number;
    longitude: number;
    specimenCount: number;
    location: readonly LocationLevel[];
};

const project = (lat: number, lng: number) => ({
    x: EARTH_RADIUS * lng * RAD,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
});

const unproject = (x: number, y: number): [number, number] => [
    x / EARTH_RADIUS / RAD,
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) / RAD,
];

/** The pointy-top hex holding a projected point, in axial coordinates. */
function hexOf(x: number, y: number, size: number) {
    const q = ((Math.sqrt(3) / 3) * x - y / 3) / size;
    const r = ((2 / 3) * y) / size;
    // Cube rounding: round all three, then fix the one that moved most.
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return { q: rq, r: rr };
}

function hexRing(q: number, r: number, size: number): [number, number][] {
    const cx = size * Math.sqrt(3) * (q + r / 2);
    const cy = size * 1.5 * r;
    const ring = Array.from({ length: 6 }, (_, i) => {
        const angle = (60 * i - 30) * RAD;
        return unproject(
            cx + size * Math.cos(angle),
            cy + size * Math.sin(angle),
        );
    });
    return [...ring, ring[0]];
}

/**
 * Placed Sessions binned into a hex grid per Program, shaded green by
 * specimens on the area shading's scale. Each cell is named for the places
 * its Sessions share and carries its Session ids, so a click selects them.
 */
export function buildHexShading(
    sessions: readonly HexSession[],
    size = HEX_SIZE_METRES,
): SpecimenShade[] {
    const cells = new Map<
        string,
        {
            programId: number;
            q: number;
            r: number;
            specimens: number;
            sessions: HexSession[];
        }
    >();
    for (const session of sessions) {
        const { x, y } = project(session.latitude, session.longitude);
        const { q, r } = hexOf(x, y, size);
        const key = `hex:${session.programId}:${q}:${r}`;
        const cell = cells.get(key) ?? {
            programId: session.programId,
            q,
            r,
            specimens: 0,
            sessions: [],
        };
        cells.set(key, cell);
        cell.specimens += session.specimenCount;
        cell.sessions.push(session);
    }
    const maximum = Math.max(0, ...[...cells.values()].map(c => c.specimens));
    const named = new Map<string, number>();
    return [...cells].map(([key, cell]) => {
        const shared = sharedLocationPath(
            cell.sessions.map(session => [...session.location]),
        );
        const place = shared.at(-1)?.name ?? '';
        // Names select and highlight a cell, so two cells never share one.
        const seen = (named.get(`${cell.programId}/${place}`) ?? 0) + 1;
        named.set(`${cell.programId}/${place}`, seen);
        return {
            key,
            programId: cell.programId,
            name: seen > 1 || !place ? `${place || '?'} (${seen})` : place,
            depth: 0,
            sessionIds: cell.sessions.map(session => session.sessionId),
            specimens: cell.specimens,
            fillColor: progressScanFillColor(cell.specimens, maximum),
            geometry: {
                type: 'MultiPolygon',
                coordinates: [[hexRing(cell.q, cell.r, size)]],
            },
        };
    });
}
