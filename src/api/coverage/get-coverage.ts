import 'server-only';

import { loadPrograms } from '@/api/admin/load-programs';
import {
    boundariesForCountry,
    countryOutline,
} from '@/api/coverage/boundaries';
import { loadCoverage } from '@/api/coverage/load-coverage';
import type {
    CoverageResponse,
    GetCoverageQuery,
} from '@/api/coverage/validation/coverage-schema';
import { buildCoverageMetrics } from '@/features/dashboard/utils/build-coverage-metrics';
import { matchCoverageBoundaries } from '@/features/dashboard/utils/match-coverage-boundaries';
import { canSeeProgram, type Viewer } from '@/lib/auth-session/viewer';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';

export async function getCoverage(
    query: GetCoverageQuery,
    viewer: Viewer,
): Promise<Result<CoverageResponse, NetworkError>> {
    const [programs, coverage] = await Promise.all([
        loadPrograms(),
        loadCoverage(),
    ]);
    if (!programs.ok) return programs;

    // Same scoping as the dashboard: a Stakeholder sees only their Programs.
    const visible = programs.data.filter(program =>
        canSeeProgram(viewer, program.programId),
    );
    const excluded = new Set(query.exclude);
    const selected = visible.filter(p => !excluded.has(p.programId));
    const selectedIds = selected.map(program => program.programId);
    // Outlines come from committed files, so they show even when the
    // workbook can't be read.
    const outlines = [...new Set(selected.map(p => p.country))].flatMap(
        country => {
            const geometry = countryOutline(country);
            return geometry ? [{ country, geometry }] : [];
        },
    );

    if (!coverage.ok)
        return ok({
            viewer: viewer.role,
            programs: visible,
            coverage,
            outlines,
        });
    const { figures, source, savedAt, liveProblem } = coverage.data;
    return ok({
        viewer: viewer.role,
        programs: visible,
        outlines,
        coverage: ok({
            source,
            savedAt,
            liveProblem,
            programs: buildCoverageMetrics(figures, selectedIds),
            ...matchCoverageBoundaries(
                figures.units.filter(unit =>
                    selectedIds.includes(unit.programId),
                ),
                new Map(
                    selected.map(program => [
                        program.programId,
                        boundariesForCountry(program.country),
                    ]),
                ),
            ),
        }),
    });
}
