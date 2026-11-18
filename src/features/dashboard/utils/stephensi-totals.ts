import type { ProgressStephensi } from '@/api/progress/validation/progress-schema';

/** Each model names it differently, e.g. "An. stephensi (suspected)". */
export function isStephensi(species: string): boolean {
    return /stephensi/i.test(species);
}

/** The one name Stakeholders see for every stephensi label. */
export const STEPHENSI_LABEL = 'Anopheles stephensi';

/** Specimens per month across every label, for one District or all of them. */
export function sumStephensiMonths(
    months: readonly string[],
    rows: readonly ProgressStephensi[],
    districtKey: string | null,
): { month: string; count: number }[] {
    const totals = new Map(months.map(month => [month, 0]));
    for (const row of rows)
        for (const district of row.districts) {
            if (districtKey !== null && district.key !== districtKey) continue;
            for (const { month, specimens } of district.monthly)
                if (totals.has(month))
                    totals.set(month, totals.get(month)! + specimens);
        }
    return [...totals].map(([month, count]) => ({ month, count }));
}

/**
 * Specimens per District key across every label and Program, up to and
 * including `upTo`, or for the whole period. Districts with none are left out.
 */
export function sumStephensiByDistrict(
    rows: readonly ProgressStephensi[],
    upTo: string | null = null,
): Map<string, number> {
    const totals = new Map<string, number>();
    for (const row of rows)
        for (const district of row.districts) {
            const specimens =
                upTo === null
                    ? district.specimens
                    : district.monthly
                          .filter(({ month }) => month <= upTo)
                          .reduce((sum, month) => sum + month.specimens, 0);
            if (specimens > 0)
                totals.set(
                    district.key,
                    (totals.get(district.key) ?? 0) + specimens,
                );
        }
    return totals;
}

/** The timeline panel's stephensi figures, up to and including `month`. */
export type StephensiTimelineFigures = {
    /** Specimens in each month of the period. */
    months: { month: string; count: number }[];
    /** Specimens in `month` alone. */
    added: number;
    /** Named areas with a specimen so far. */
    areas: number;
    /** Countries with a specimen so far, by each row's Program. */
    countries: number;
};

export function stephensiTimelineFigures(
    rows: readonly ProgressStephensi[],
    periodMonths: readonly string[],
    month: string,
    districtKey: string | null,
    countryOf: ReadonlyMap<number, string>,
): StephensiTimelineFigures {
    const months = sumStephensiMonths(periodMonths, rows, districtKey);
    const areas = new Set<string>();
    const countries = new Set<string>();
    for (const row of rows)
        for (const district of row.districts) {
            if (districtKey !== null && district.key !== districtKey) continue;
            const found = district.monthly.some(
                entry => entry.month <= month && entry.specimens > 0,
            );
            if (!found) continue;
            // "District not recorded" is no area of its own.
            if (!district.key.endsWith(':unknown')) areas.add(district.key);
            const country = countryOf.get(row.programId);
            if (country) countries.add(country);
        }
    return {
        months,
        added: months.find(row => row.month === month)?.count ?? 0,
        areas: areas.size,
        countries: countries.size,
    };
}
