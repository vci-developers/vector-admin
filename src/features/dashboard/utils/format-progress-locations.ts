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

/** Add the counts that exist; null only when there are none to add. */
export function sumAvailableCounts(
    counts: readonly (number | null)[],
): number | null {
    const known = counts.filter(count => count !== null);
    if (known.length === 0) return null;
    return known.reduce((sum, count) => sum + count, 0);
}

export function totalProgressLocations(
    coverage: readonly ProgressLocationCoverage[],
): number | null {
    return sumAvailableCounts(coverage.map(entry => entry.count));
}

/** Beside a total: the shared unit, or the generic label for mixed ones. */
export function locationTotalUnit(
    coverage: readonly ProgressLocationCoverage[],
    total: number | null,
): string {
    const units = new Set(coverage.map(entry => entry.unit));
    if (units.size === 1)
        return progressLocationUnitLabel(coverage[0].unit, total);
    return total === 1 ? 'reporting location' : 'reporting locations';
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

/** Programs never share a Sentinel Site, so their counts add up. */
export function totalSentinelSites(
    rows: readonly ProgressSentinelSites[],
): number | null {
    return sumAvailableCounts(rows.map(row => row.count));
}

export function sentinelSiteLabel(count: number | null): string {
    return count === 1 ? 'sentinel site' : 'sentinel sites';
}

/** "1 sentinel site", "3 sentinel sites". */
export function formatSentinelSites(
    count: number,
    formatNumber: (count: number) => string,
): string {
    return `${formatNumber(count)} ${sentinelSiteLabel(count)}`;
}
