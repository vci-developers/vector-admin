import type {
    ProgressLocationCoverage,
    ProgressSentinelSites,
} from '@/api/progress/validation/progress-schema';

const labels: Record<ProgressLocationCoverage['unit'], [string, string]> = {
    household: ['household', 'households'],
    municipality: ['municipality', 'municipalities'],
    community: ['community', 'communities'],
    'health-district': ['health district', 'health districts'],
    'collection-site': ['collection site', 'collection sites'],
};

/** Sum program counts only under the generic reporting-location label. */
export function totalProgressLocations(
    coverage: readonly ProgressLocationCoverage[],
): number | null {
    if (coverage.length === 0 || coverage.some(entry => entry.count === null))
        return null;
    return coverage.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
}

/** Display the reviewed reporting unit without treating different units as equal. */
export function progressLocationUnitLabel(
    unit: ProgressLocationCoverage['unit'],
    count?: number | null,
): string {
    return labels[unit][count === 1 ? 0 : 1];
}

/** A missing count keeps its whole unit subtotal unavailable. */
export function groupProgressLocationsByUnit(
    coverage: readonly ProgressLocationCoverage[],
): { unit: ProgressLocationCoverage['unit']; count: number | null }[] {
    const grouped = new Map<ProgressLocationCoverage['unit'], number | null>();
    for (const { unit, count } of coverage) {
        const previous = grouped.get(unit);
        grouped.set(
            unit,
            count === null || previous === null
                ? null
                : (previous ?? 0) + count,
        );
    }
    return [...grouped].map(([unit, count]) => ({ unit, count }));
}

/** Shared by the donor card, map accessibility and exported actuals. */
export function formatProgressLocations(
    coverage: readonly ProgressLocationCoverage[],
    formatNumber: (count: number) => string,
): string {
    const groups = groupProgressLocationsByUnit(coverage);
    if (groups.length === 0) return 'Reporting coverage unavailable';
    return groups
        .map(({ unit, count }) => {
            const label = progressLocationUnitLabel(unit, count);
            return count === null
                ? `${label.charAt(0).toUpperCase()}${label.slice(1)} unavailable`
                : `${formatNumber(count)} ${label}`;
        })
        .join(' · ');
}

/** Programs never share a Sentinel Site, so their counts add up; any missing one makes the total unknown. */
export function totalSentinelSites(
    rows: readonly ProgressSentinelSites[],
): number | null {
    if (rows.length === 0 || rows.some(row => row.count === null)) return null;
    return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
}

/** "1 sentinel site", "3 sentinel sites". */
export function formatSentinelSites(
    count: number,
    formatNumber: (count: number) => string,
): string {
    return `${formatNumber(count)} ${count === 1 ? 'sentinel site' : 'sentinel sites'}`;
}
