export const DENSITY_COOKIE = 'density';

export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const;

export type Density = (typeof DENSITIES)[number];

export function parseDensity(value: string | undefined): Density {
    return DENSITIES.find(density => density === value) ?? 'comfortable';
}
