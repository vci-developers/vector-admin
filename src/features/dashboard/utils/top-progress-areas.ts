import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';

type Area = Pick<ProgressDistrict, 'key' | 'name' | 'country' | 'uniqueScans'>;

/** Compare scan volume across the selected programs without requiring map coordinates. */
export function topProgressAreas<T extends Area>(areas: readonly T[]): T[] {
    return areas
        .filter(area => area.uniqueScans > 0)
        .toSorted(
            (a, b) =>
                b.uniqueScans - a.uniqueScans ||
                a.country.localeCompare(b.country) ||
                a.name.localeCompare(b.name) ||
                a.key.localeCompare(b.key),
        )
        .slice(0, 6);
}
