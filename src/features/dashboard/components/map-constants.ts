// Kept out of surveillance-map.tsx so importing them never pulls Leaflet into
// the server render.
export type MapLayer = 'specimens' | 'devices';

// Device status colors; the map legend carries the meaning in text.
export const ACTIVE_COLOR = '#15803d';
export const IDLE_COLOR = '#6b7280';
