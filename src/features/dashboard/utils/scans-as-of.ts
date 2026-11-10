import type {
    ProgressDistrict,
    ProgressSpecies,
} from '@/api/progress/validation/progress-schema';
import { speciesListOf, UNKNOWN_DISTRICT } from './build-progress';

/**
 * Each District's scans up to and including `month`, by key; undefined for the
 * whole period. Scans and specimens can be added month by month; sites can't,
 * as a site reporting in two months would count twice.
 */
export function scansAsOf(
    districts: readonly ProgressDistrict[],
    month: string | null,
): ReadonlyMap<string, number> | undefined {
    if (month === null) return undefined;
    return new Map(
        districts.map(district => [
            district.key,
            district.monthly
                .filter(row => row.month <= month)
                .reduce((sum, row) => sum + row.uniqueScans, 0),
        ]),
    );
}

/** The Districts with scans in `month` alone, by key. */
export function scansInMonth(
    districts: readonly ProgressDistrict[],
    month: string,
): ReadonlyMap<string, number> {
    return new Map(
        districts.flatMap(district => {
            const scans =
                district.monthly.find(row => row.month === month)
                    ?.uniqueScans ?? 0;
            return scans > 0 ? [[district.key, scans] as const] : [];
        }),
    );
}

/** Specimens per species up to `month`; undefined for the whole period. */
export function speciesAsOf(
    districts: readonly ProgressDistrict[],
    month: string | null,
): ProgressSpecies[] | undefined {
    if (month === null) return undefined;
    const counts = new Map<string | null, number>();
    for (const district of districts)
        for (const row of district.speciesMonthly)
            if (row.month <= month)
                for (const { name, specimens } of row.species)
                    counts.set(name, (counts.get(name) ?? 0) + specimens);
    return speciesListOf(counts);
}

export type TimelineFigures = {
    /** Scans in each month of the period, for these Districts. */
    months: { month: string; scans: number }[];
    /** Scans in `month` alone. */
    added: number;
    specimens: number;
    areas: number;
    countries: number;
};

/** The running figures up to and including `month`. */
export function timelineFigures(
    districts: readonly ProgressDistrict[],
    periodMonths: readonly string[],
    month: string,
): TimelineFigures {
    const months = periodMonths.map(key => ({
        month: key,
        scans: districts.reduce(
            (sum, district) =>
                sum +
                (district.monthly.find(row => row.month === key)?.uniqueScans ??
                    0),
            0,
        ),
    }));
    // Any upload counts, as on the tiles: practice, or one with no images.
    const reporting = districts.filter(district =>
        district.reportingMonths.some(key => key <= month),
    );
    return {
        months,
        added: months.find(row => row.month === month)?.scans ?? 0,
        specimens: (speciesAsOf(districts, month) ?? []).reduce(
            (sum, row) => sum + row.specimens,
            0,
        ),
        areas: reporting.filter(row => row.name !== UNKNOWN_DISTRICT).length,
        countries: new Set(reporting.map(row => row.country)).size,
    };
}

/**
 * Countries with any upload up to and including `month`: on the timeline a
 * country stays faint until its first upload. Null for the whole period.
 */
export function countriesStartedBy(
    districts: readonly ProgressDistrict[],
    month: string | null,
): ReadonlySet<string> | undefined {
    if (month === null) return undefined;
    return new Set(
        districts
            .filter(district =>
                district.reportingMonths.some(key => key <= month),
            )
            .map(district => district.country),
    );
}
