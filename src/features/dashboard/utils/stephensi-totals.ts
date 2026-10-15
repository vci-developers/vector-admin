import type { ProgressStephensi } from '@/api/progress/validation/progress-schema';

/** Each model names it differently, e.g. "An. stephensi (suspected)". */
export function isStephensi(species: string): boolean {
    return /stephensi/i.test(species);
}

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

/** Specimens per District key across every label and Program. */
export function sumStephensiByDistrict(
    rows: readonly ProgressStephensi[],
): Map<string, number> {
    const totals = new Map<string, number>();
    for (const row of rows)
        for (const district of row.districts)
            totals.set(
                district.key,
                (totals.get(district.key) ?? 0) + district.specimens,
            );
    return totals;
}
