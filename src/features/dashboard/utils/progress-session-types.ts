import {
    progressSessionTypeSchema,
    type ProgressSessionType,
    type ProgressTypeScans,
} from '@/api/progress/validation/progress-schema';

export const PROGRESS_SESSION_TYPE_LABELS: Record<ProgressSessionType, string> =
    {
        SURVEILLANCE: 'Surveillance',
        DATA_COLLECTION: 'Calibration',
        PRACTICE: 'Training',
    };

/**
 * The URL's `types` is shared with the Developer view, which also offers
 * CALIBRATION and an empty selection; neither applies here.
 */
export function selectProgressSessionTypes(
    types: readonly string[],
): ProgressSessionType[] {
    const selected = progressSessionTypeSchema.options.filter(type =>
        types.includes(type),
    );
    return selected.length > 0 ? selected : ['SURVEILLANCE'];
}

/** A split says something only when two or more types have scans. */
export function scanTypeBreakdown(
    rows: ProgressTypeScans[],
): ProgressTypeScans[] {
    const withScans = rows.filter(row => row.scans > 0);
    return withScans.length >= 2 ? withScans : [];
}

/** Adds up per-type rows, e.g. for a map node covering several Districts. */
export function sumScansByType(
    groups: readonly ProgressTypeScans[][],
): ProgressTypeScans[] {
    return progressSessionTypeSchema.options.flatMap(type => {
        const rows = groups.flat().filter(row => row.type === type);
        return rows.length > 0
            ? [{ type, scans: rows.reduce((sum, row) => sum + row.scans, 0) }]
            : [];
    });
}
