import { programSchema } from '@/api/program/validation/program-schema';
import { sessionTypeSchema } from '@/api/session/validation/session-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const programIdListSchema = z
    .string()
    .regex(/^(\d+(,\d+)*)?$/)
    .transform(value => (value === '' ? [] : value.split(',').map(Number)));

/** The page-wide Session filter, shared by every dashboard query. */
export const sessionScopeQuerySchema = z.object({
    types: z
        .string()
        .transform(value => (value === '' ? [] : value.split(',')))
        .pipe(z.array(sessionTypeSchema))
        .default(['SURVEILLANCE']),
    testSites: z
        .enum(['true', 'false'])
        .transform(value => value === 'true')
        .default(false),
});

export const getDashboardQuerySchema = z
    .object({
        exclude: programIdListSchema.default([]),
        from: monthKeySchema.optional(),
        to: monthKeySchema,
        ...sessionScopeQuerySchema.shape,
    })
    .refine(({ from, to }) => !from || from <= to, 'from must not be after to');

export type GetDashboardQuery = z.infer<typeof getDashboardQuerySchema>;

const fieldRecord = <T extends z.ZodType>(value: T) =>
    z.object({
        species: value,
        captureDate: value,
        geolocation: value,
        operatorId: value,
    });

const nullableRatio = z.number().nullable();

export const periodMetricsSchema = z.object({
    activeDevices: z.number(),
    images: z.number(),
    uniqueSpecimens: z.number(),
    records: z.number(),
    completeRecords: z.number(),
    fieldPasses: fieldRecord(z.number()),
    dhis2Records: z.number(),
    submittedRecords: z.number(),
    uniqueUsers: z.number().nullable(),
    logins: z.number().nullable(),
    imagesPerActiveDevice: nullableRatio,
    metadataCompleteness: nullableRatio,
    fieldCompleteness: fieldRecord(nullableRatio),
    dhis2UploadRate: nullableRatio,
    /** Seconds between consecutive images; null with no gap to time. */
    timing: z
        .object({
            count: z.number(),
            median: z.number(),
            p25: z.number(),
            p75: z.number(),
            mean: z.number(),
            sd: z.number().nullable(),
        })
        .nullable(),
});

/** A coverage figure's working; null where the workbook has no figure. */
export const coverageRatioSchema = z
    .object({
        numerator: z.number(),
        denominator: z.number(),
        value: z.number().nullable(),
    })
    .nullable();

/** Active users (from VectorCam) over the coverage workbook's figures. */
export const userCoverageSchema = z.object({
    programId: z.number(),
    /** The month compared: the period's last. */
    month: monthKeySchema,
    instantaneousUserCoverage: coverageRatioSchema,
    programUserCoverage: coverageRatioSchema,
});

export const deviceRowSchema = z.object({
    deviceId: z.number(),
    model: z.string(),
    programId: z.number(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'NEVER_USED']),
    position: z
        .object({ latitude: z.number(), longitude: z.number() })
        .nullable(),
    /** Latest Session's Site, the fallback location when position is null. */
    siteId: z.number().nullable(),
    lastSubmittedAt: z.number().nullable(),
});

export const locationLevelSchema = z.object({
    level: z.string(),
    name: z.string(),
});

export const areaMetricsSchema = z.object({
    programId: z.number(),
    level: z.string().nullable(),
    name: z.string().nullable(),
    metrics: periodMetricsSchema,
});

export const dashboardSchema = z.object({
    /** What the page shows: everything, or the Stakeholder view. */
    viewer: z.enum(['developer', 'stakeholder']),
    programs: z.array(programSchema),
    selectedProgramIds: z.array(z.number()),
    failedProgramIds: z.array(z.number()),
    metrics: z.object({
        from: monthKeySchema,
        to: monthKeySchema,
        programs: z.array(
            z.object({
                programId: z.number(),
                metrics: periodMetricsSchema,
                cycles: z.array(z.number()),
            }),
        ),
        /** For Stakeholders, users and logins are always null. */
        total: periodMetricsSchema.nullable(),
        /** Always null for Stakeholders. */
        previousTotal: periodMetricsSchema.nullable(),
    }),
    /** Device Status over the period. */
    devices: z.array(deviceRowSchema),
    /** Each Program's metrics per top-level area (District, Region). */
    areas: z.array(areaMetricsSchema),
    /** Each Site's place names, broadest first, keyed by siteId. */
    sitePaths: z.record(z.string(), z.array(locationLevelSchema)),
    specimenPoints: z.object({
        placed: z.array(
            z.object({
                sessionId: z.number(),
                programId: z.number(),
                deviceId: z.number(),
                siteId: z.number(),
                latitude: z.number(),
                longitude: z.number(),
                specimenCount: z.number(),
                specimenGroups: z.array(
                    z.object({
                        species: z.string().nullable(),
                        sex: z.string().nullable(),
                        abdomenStatus: z.string().nullable(),
                        count: z.number(),
                    }),
                ),
                collectedAt: z.number(),
                month: monthKeySchema,
                /** One number per person named, within the Program. */
                collectorIds: z.array(z.number()),
            }),
        ),
        /** Sessions without an in-country fix; placed at their Site when it geocodes. */
        unplaced: z.array(
            z.object({
                sessionId: z.number(),
                programId: z.number(),
                deviceId: z.number(),
                siteId: z.number(),
                specimenCount: z.number(),
                specimenGroups: z.array(
                    z.object({
                        species: z.string().nullable(),
                        sex: z.string().nullable(),
                        abdomenStatus: z.string().nullable(),
                        count: z.number(),
                    }),
                ),
                collectedAt: z.number(),
                month: monthKeySchema,
                /** One number per person named, within the Program. */
                collectorIds: z.array(z.number()),
            }),
        ),
    }),
    /**
     * Each selected Program's user coverage for the period's last month,
     * counting collectors on the Sessions the Session filter keeps.
     */
    userCoverage: z.array(userCoverageSchema),
    /** Oldest snapshot fetch time among loaded Programs; null if none loaded. */
    lastUpdatedAt: z.number().nullable(),
});

export const getDashboardResponseSchema = resultSchema(dashboardSchema);

export type Dashboard = z.infer<typeof dashboardSchema>;
export type AreaMetricsDto = z.infer<typeof areaMetricsSchema>;
export type UserCoverageDto = z.infer<typeof userCoverageSchema>;
export type PeriodMetricsDto = z.infer<typeof periodMetricsSchema>;
