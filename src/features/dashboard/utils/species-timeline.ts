import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import { UNKNOWN_DISTRICT } from './build-progress';
import { seriesKeyOf } from './build-species-months';

/** One species' specimens in one District's month. */
function specimensIn(
    row: ProgressDistrict['speciesMonthly'][number],
    seriesKey: string,
): number {
    return row.species
        .filter(entry => seriesKeyOf(entry.name) === seriesKey)
        .reduce((sum, entry) => sum + entry.specimens, 0);
}

/**
 * Each District's specimens of one species, up to and including `month`, or
 * for the whole period when `month` is null. Keyed by District key.
 */
export function speciesSpecimensByDistrict(
    districts: readonly ProgressDistrict[],
    seriesKey: string,
    month: string | null,
): Map<string, number> {
    return new Map(
        districts.map(district => [
            district.key,
            district.speciesMonthly
                .filter(row => month === null || row.month <= month)
                .reduce((sum, row) => sum + specimensIn(row, seriesKey), 0),
        ]),
    );
}

/** The timeline panel's figures for one species, up to and including `month`. */
export type SpeciesTimelineFigures = {
    /** Specimens in each month of the period. */
    months: { month: string; count: number }[];
    /** Specimens in `month` alone. */
    added: number;
    /** Named areas with a specimen so far. */
    areas: number;
    /** Countries with a specimen so far. */
    countries: number;
};

export function speciesTimelineFigures(
    districts: readonly ProgressDistrict[],
    periodMonths: readonly string[],
    month: string,
    seriesKey: string,
): SpeciesTimelineFigures {
    const months = periodMonths.map(key => ({
        month: key,
        count: districts.reduce(
            (sum, district) =>
                sum +
                district.speciesMonthly
                    .filter(row => row.month === key)
                    .reduce(
                        (total, row) => total + specimensIn(row, seriesKey),
                        0,
                    ),
            0,
        ),
    }));
    const found = speciesSpecimensByDistrict(districts, seriesKey, month);
    const reporting = districts.filter(
        district => (found.get(district.key) ?? 0) > 0,
    );
    return {
        months,
        added: months.find(row => row.month === month)?.count ?? 0,
        areas: reporting.filter(row => row.name !== UNKNOWN_DISTRICT).length,
        countries: new Set(reporting.map(row => row.country)).size,
    };
}

/** A place's share of a species' specimens: a country, or an area in one. */
export type SpecimenPlace = { key: string; name: string; specimens: number };

/**
 * Specimens per country, or per area when `by` is 'area', most first; places
 * with none are left out. "District not recorded" reads "Area not recorded".
 */
export function specimensByPlace(
    counts: ReadonlyMap<string, number>,
    districts: readonly ProgressDistrict[],
    by: 'country' | 'area',
): SpecimenPlace[] {
    const places = new Map<string, SpecimenPlace>();
    for (const district of districts) {
        const specimens = counts.get(district.key) ?? 0;
        if (specimens <= 0) continue;
        const key = by === 'country' ? district.country : district.key;
        const name =
            by === 'country'
                ? district.country
                : district.name === UNKNOWN_DISTRICT
                  ? 'Area not recorded'
                  : district.name;
        const place = places.get(key) ?? { key, name, specimens: 0 };
        place.specimens += specimens;
        places.set(key, place);
    }
    return [...places.values()].sort(
        (a, b) => b.specimens - a.specimens || a.name.localeCompare(b.name),
    );
}
