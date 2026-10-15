// Kept out of surveillance-map.tsx so importing them never pulls Leaflet into
// the server render.
export const MAP_LAYERS = ['specimens', 'devices', 'coverage'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];
// Every layer is asked for: by default the map is the specimen shading alone,
// which is always there.
export const DEFAULT_MAP_LAYERS: MapLayer[] = [];
/** The layers drawn as clickable points; Coverage is fills only. */
export type PointLayer = Exclude<MapLayer, 'coverage'>;

// Device status colours; the map key carries the meaning in text.
export const ACTIVE_COLOR = '#15803d';
export const IDLE_COLOR = '#6b7280';
export const ZERO_CATCH_COLOR = '#b91c1c';

// Coverage Status: the map fills only these. Active is left out because the
// specimen shading already greens every area reporting.
export const FILLED_COVERAGE_STATUSES = [
    'Targeted',
    'Surveillance only',
] as const;
export type FilledCoverageStatus = (typeof FILLED_COVERAGE_STATUSES)[number];

// Hues the points don't use (specimens are red, devices green), so a fill
// never reads as catch size or device status.
export const COVERAGE_STYLES = {
    Targeted: {
        color: '#d97706',
        fillOpacity: 0.25,
        weight: 2,
    },
    'Surveillance only': {
        color: '#9333ea',
        fillOpacity: 0.18,
        weight: 1.5,
    },
} as const satisfies Record<
    FilledCoverageStatus,
    { color: string; fillOpacity: number; weight: number }
>;
