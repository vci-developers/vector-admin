import type { ProgressMapPosition } from './build-progress-map-nodes';

export type ProgressMapExtent = {
    south: number;
    west: number;
    north: number;
    east: number;
};

const MERCATOR_LATITUDE = 85.0511287798066;
export const PROGRESS_MAP_MAX_ZOOM = 12;

/** Navigation framing only; this rectangle never represents reporting coverage. */
export function progressMapExtent(
    positions: readonly ProgressMapPosition[],
): ProgressMapExtent | null {
    const valid = positions.filter(
        point =>
            Number.isFinite(point.latitude) &&
            Number.isFinite(point.longitude) &&
            Math.abs(point.latitude) <= 90 &&
            Math.abs(point.longitude) <= 180,
    );
    if (valid.length === 0) return null;
    const latitudes = valid.map(point =>
        Math.max(
            -MERCATOR_LATITUDE,
            Math.min(MERCATOR_LATITUDE, point.latitude),
        ),
    );
    const longitudes = valid.map(point => point.longitude);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const latitudeMargin = Math.max(1, (north - south) * 0.2);
    const longitudeMargin = Math.max(1, (east - west) * 0.2);
    return {
        south: Math.max(-MERCATOR_LATITUDE, south - latitudeMargin),
        west: Math.max(-180, west - longitudeMargin),
        north: Math.min(MERCATOR_LATITUDE, north + latitudeMargin),
        east: Math.min(180, east + longitudeMargin),
    };
}

function mercatorY(latitude: number) {
    const radians = (latitude * Math.PI) / 180;
    return 0.5 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / (2 * Math.PI);
}

/** Independent of the map's old zoom limits, including after country changes. */
export function progressMapMinimumZoom(
    extent: ProgressMapExtent,
    viewport: { width: number; height: number },
): number {
    if (
        !Number.isFinite(viewport.width) ||
        !Number.isFinite(viewport.height) ||
        viewport.width <= 0 ||
        viewport.height <= 0
    )
        return 1;
    const width = (256 * (extent.east - extent.west)) / 360;
    const height = 256 * (mercatorY(extent.south) - mercatorY(extent.north));
    const fitZoom = Math.log2(
        Math.min(viewport.width / width, viewport.height / height),
    );
    // A little room to zoom out, while keeping country-only overview reachable.
    return Math.max(1, Math.min(5.5, Math.floor((fitZoom - 0.75) * 4) / 4));
}

export function clampProgressMapZoom(
    zoom: number,
    minimum: number,
    maximum = PROGRESS_MAP_MAX_ZOOM,
): number {
    return Math.max(
        minimum,
        Math.min(maximum, Number.isNaN(zoom) ? minimum : zoom),
    );
}
