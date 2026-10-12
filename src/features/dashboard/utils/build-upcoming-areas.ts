import type { CoverageResponse } from '@/api/coverage/validation/coverage-schema';
import type { MultiPolygon } from './match-coverage-boundaries';
import { progressDistrictKey } from './build-progress';

export type UpcomingArea = {
    key: string;
    name: string;
    geometry: MultiPolygon;
};

/**
 * Workbook units Targeted for VectorCam, drawn as upcoming, one per shape:
 * two Targeted sites in Baringo draw Baringo once. A shape that already
 * reports in the period shows as reporting instead.
 */
export function buildUpcomingAreas(
    coverage: CoverageResponse,
    reportingKeys: ReadonlySet<string>,
): UpcomingArea[] {
    if (!coverage.coverage.ok) return [];
    const countries = new Map(
        coverage.programs.map(program => [program.programId, program.country]),
    );
    const areas = new Map<string, UpcomingArea>();
    for (const fill of coverage.coverage.data.fills) {
        const country = countries.get(fill.programId);
        if (fill.status !== 'Targeted' || !country) continue;
        const key = progressDistrictKey(country, fill.area, fill.programId);
        if (!reportingKeys.has(key))
            areas.set(key, { key, name: fill.area, geometry: fill.geometry });
    }
    return [...areas.values()];
}
