import type {
    ProgressDistrict,
    ProgressStephensi,
} from '@/api/progress/validation/progress-schema';
import { seriesKeyOf } from './build-species-months';

/** Each District's scans in `month` alone, by key. */
export function scansInMonthByDistrict(
    districts: readonly ProgressDistrict[],
    month: string,
): Map<string, number> {
    return new Map(
        districts.map(district => [
            district.key,
            district.monthly.find(row => row.month === month)?.uniqueScans ?? 0,
        ]),
    );
}

/** Each District's specimens of one species in `month` alone, by key. */
export function speciesInMonthByDistrict(
    districts: readonly ProgressDistrict[],
    seriesKey: string,
    month: string,
): Map<string, number> {
    return new Map(
        districts.map(district => [
            district.key,
            district.speciesMonthly
                .filter(row => row.month === month)
                .flatMap(row => row.species)
                .filter(entry => seriesKeyOf(entry.name) === seriesKey)
                .reduce((sum, entry) => sum + entry.specimens, 0),
        ]),
    );
}

/**
 * An. stephensi specimens in `month` alone, by District key, across every
 * label and Program. Districts with none are left out.
 */
export function stephensiInMonthByDistrict(
    rows: readonly ProgressStephensi[],
    month: string,
): Map<string, number> {
    const totals = new Map<string, number>();
    for (const row of rows)
        for (const district of row.districts) {
            const specimens = district.monthly
                .filter(entry => entry.month === month)
                .reduce((sum, entry) => sum + entry.specimens, 0);
            if (specimens > 0)
                totals.set(
                    district.key,
                    (totals.get(district.key) ?? 0) + specimens,
                );
        }
    return totals;
}
