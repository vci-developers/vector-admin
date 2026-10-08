// Kept out of surveillance-map.tsx so importing them never pulls Leaflet into
// the server render.
export const MAP_LAYERS = ['specimens', 'devices', 'coverage'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];
/** The layers drawn as clickable points; Coverage is fills only. */
export type PointLayer = Exclude<MapLayer, 'coverage'>;

// Device status colours; the map key carries the meaning in text.
export const ACTIVE_COLOR = '#15803d';
export const IDLE_COLOR = '#6b7280';
export const ZERO_CATCH_COLOR = '#b91c1c';

// Coverage Status: three distinct hues the points don't use (specimens are
// red, devices green), so a fill never reads as catch size or device status.
export const COVERAGE_STYLES = {
    Active: { color: '#2563eb', fillOpacity: 0.3, weight: 2 },
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
} as const;
