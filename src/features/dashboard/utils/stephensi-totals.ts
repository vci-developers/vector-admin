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
