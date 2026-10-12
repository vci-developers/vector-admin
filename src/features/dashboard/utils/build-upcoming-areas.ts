import type { CoverageResponse } from '@/api/coverage/validation/coverage-schema';
import type { MultiPolygon } from './match-coverage-boundaries';
import { progressDistrictKey } from './build-progress';

export type UpcomingArea = {
    key: string;
    name: string;
    geometry: MultiPolygon;
};

/**
 * Workbook units Targeted for VectorCam, drawn as upcoming. A unit that
 * already reports in the period shows as reporting instead.
 */
export function buildUpcomingAreas(
    coverage: CoverageResponse,
    reportingKeys: ReadonlySet<string>,
): UpcomingArea[] {
    if (!coverage.coverage.ok) return [];
    const countries = new Map(
        coverage.programs.map(program => [program.programId, program.country]),
    );
    return coverage.coverage.data.fills.flatMap(fill => {
        const country = countries.get(fill.programId);
        if (fill.status !== 'Targeted' || !country) return [];
        const key = progressDistrictKey(country, fill.unit, fill.programId);
        return reportingKeys.has(key)
            ? []
            : [{ key, name: fill.unit, geometry: fill.geometry }];
    });
}
