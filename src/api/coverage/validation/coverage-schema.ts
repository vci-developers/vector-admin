import {
    coverageRatioSchema,
    programIdListSchema,
} from '@/api/dashboard/validation/dashboard-schema';
import { programSchema } from '@/api/program/validation/program-schema';
import { multiPolygonSchema } from '@/features/dashboard/utils/match-coverage-boundaries';
import { COVERAGE_STATUSES } from '@/features/dashboard/utils/parse-coverage-sheets';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

export const getCoverageQuerySchema = z.object({
    exclude: programIdListSchema.default([]),
});

export type GetCoverageQuery = z.infer<typeof getCoverageQuerySchema>;

export const programCoverageSchema = z.object({
    programId: z.number(),
    geographicCoverage: coverageRatioSchema,
    penetration: coverageRatioSchema,
});

const coverageFillSchema = z.object({
    programId: z.number(),
    unit: z.string(),
    status: z.enum(COVERAGE_STATUSES),
    geometry: multiPolygonSchema,
});

/** The team's coverage workbook for the selected Programs. */
export const coverageSchema = z.discriminatedUnion('ok', [
    z.object({
        ok: z.literal(true),
        data: z.object({
            source: z.enum(['live', 'saved']),
            savedAt: z.number().nullable(),
            liveProblem: z.string().nullable(),
            programs: z.array(programCoverageSchema),
            /** Each matched Coverage Unit's shape, filled by status. */
            fills: z.array(coverageFillSchema),
            /** Workbook rows with no shape to draw. */
            unmatched: z.array(
                z.object({
                    programId: z.number(),
                    unit: z.string(),
                    lookedUp: z.string(),
                }),
            ),
        }),
    }),
    z.object({ ok: z.literal(false), error: z.string() }),
]);

/**
 * Coverage for the selected Programs the viewer may see. Served apart from
 * the dashboard: it loads in about a second, Sessions in up to ~30 s.
 */
export const coverageResponseSchema = z.object({
    /** Lets the loading page draw only what this viewer will get. */
    viewer: z.enum(['developer', 'stakeholder']),
    programs: z.array(programSchema),
    coverage: coverageSchema,
    /** The selected Programs' countries, outlined on the map. */
    outlines: z.array(
        z.object({ country: z.string(), geometry: multiPolygonSchema }),
    ),
});

export const getCoverageResponseSchema = resultSchema(coverageResponseSchema);

export type CoverageResponse = z.infer<typeof coverageResponseSchema>;
export type CoverageDto = z.infer<typeof coverageSchema>;
export type ProgramCoverageDto = z.infer<typeof programCoverageSchema>;
export type CoverageFillDto = z.infer<typeof coverageFillSchema>;
export type CountryOutlineDto = CoverageResponse['outlines'][number];
