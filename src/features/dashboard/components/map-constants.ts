// Kept out of surveillance-map.tsx so importing them never pulls Leaflet into
// the server render.
export const MAP_LAYERS = ['specimens', 'devices'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

// Device status colours; the map key carries the meaning in text.
export const ACTIVE_COLOR = '#15803d';
export const IDLE_COLOR = '#6b7280';
export const ZERO_CATCH_COLOR = '#b91c1c';
