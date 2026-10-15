import { programIdListSchema } from '@/api/dashboard/validation/dashboard-schema';
import { programSchema } from '@/api/program/validation/program-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const countSchema = z.number().int().nonnegative();

export const getProgressQuerySchema = z
    .object({
        exclude: programIdListSchema.default([]),
        from: monthKeySchema.optional(),
        to: monthKeySchema,
    })
    .refine(({ from, to }) => !from || from <= to, 'from must not be after to');

export type GetProgressQuery = z.infer<typeof getProgressQuerySchema>;

export const progressMonthSchema = z.object({
    month: monthKeySchema,
    uniqueScans: countSchema,
});

export const progressLocationCoverageSchema = z.object({
    programId: z.number(),
    unit: z.enum([
        'household',
        'community',
        'municipality',
        'health-district',
        'collection-site',
    ]),
    count: countSchema.nullable(),
});

export type ProgressLocationCoverage = z.infer<
    typeof progressLocationCoverageSchema
>;
export type ProgressCoverageUnit = ProgressLocationCoverage['unit'];

export const progressProgramScansSchema = z.object({
    programId: z.number(),
    /** Null only when the program snapshot could not be loaded. */
    scans: countSchema.nullable(),
    /** Distinct image-backed specimens; null as for scans. */
    specimens: countSchema.nullable(),
});

export type ProgressProgramScans = z.infer<typeof progressProgramScansSchema>;

/** Specimens per species, most first; a null name has no species yet. */
export const progressSpeciesSchema = z.object({
    name: z.string().nullable(),
    specimens: countSchema,
});

export type ProgressSpecies = z.infer<typeof progressSpeciesSchema>;

/** One Program's specimens of one An. stephensi label, as the API names it. */
export const progressStephensiSchema = z.object({
    programId: z.number(),
    species: z.string(),
    specimens: countSchema,
    /** Submission month of the latest Session with one. */
    latestMonth: monthKeySchema,
    /** Most specimens first; `monthly` lists only months with one. */
    districts: z.array(
        z.object({
            key: z.string(),
            name: z.string(),
            specimens: countSchema,
            monthly: z.array(
                z.object({ month: monthKeySchema, specimens: countSchema }),
            ),
        }),
    ),
});

export type ProgressStephensi = z.infer<typeof progressStephensiSchema>;

export const progressDistrictSchema = z.object({
    key: z.string(),
    /** First contributing program for compatibility; use programIds for attribution. */
    programId: z.number(),
    programIds: z.array(z.number()),
    country: z.string(),
    name: z.string(),
    coverageByProgram: z.array(progressLocationCoverageSchema),
    scansByProgram: z.array(progressProgramScansSchema),
    reportingLocations: countSchema.nullable(),
    uniqueScans: countSchema,
    uniqueSpecimens: countSchema,
    species: z.array(progressSpeciesSchema),
    monthly: z.array(progressMonthSchema),
    position: z
        .object({ latitude: z.number(), longitude: z.number() })
        .nullable(),
    latestReceivedAt: z.number().nullable(),
});

export const progressDashboardSchema = z.object({
    programs: z.array(programSchema),
    selectedProgramIds: z.array(z.number()),
    failedProgramIds: z.array(z.number()),
    from: monthKeySchema,
    to: monthKeySchema,
    coverageByProgram: z.array(progressLocationCoverageSchema),
    scansByProgram: z.array(progressProgramScansSchema),
    /** Null for mixed units, incomplete metadata, or no selected programs. */
    reportingLocations: countSchema.nullable(),
    uniqueScans: countSchema.nullable(),
    uniqueSpecimens: countSchema.nullable(),
    species: z.array(progressSpeciesSchema),
    stephensi: z.array(progressStephensiSchema),
    districts: z.array(progressDistrictSchema),
    monthly: z.array(progressMonthSchema),
    /** Oldest API snapshot in this response. */
    lastUpdatedAt: z.number().nullable(),
    /** Most recent session upload in the selected reporting period. */
    latestReceivedAt: z.number().nullable(),
});

export const getProgressResponseSchema = resultSchema(progressDashboardSchema);

export type ProgressMonth = z.infer<typeof progressMonthSchema>;
export type ProgressDistrict = z.infer<typeof progressDistrictSchema>;
export type ProgressDashboard = z.infer<typeof progressDashboardSchema>;
