import { programSchema } from '@/api/program/validation/program-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

const programIdListSchema = z
    .string()
    .regex(/^(\d+(,\d+)*)?$/)
    .transform(value => (value === '' ? [] : value.split(',').map(Number)));

export const getDashboardQuerySchema = z
    .object({
        exclude: programIdListSchema.default([]),
        from: monthKeySchema.optional(),
        to: monthKeySchema,
        /** The summary month; Device Status is classified for it. */
        month: monthKeySchema,
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

export const monthMetricsSchema = z.object({
    activeDevices: z.number(),
    scans: z.number(),
    uniqueSpecimens: z.number(),
    records: z.number(),
    completeRecords: z.number(),
    fieldPasses: fieldRecord(z.number()),
    certifiedSessions: z.number(),
    submittedSessions: z.number(),
    scansPerActiveDevice: nullableRatio,
    metadataCompleteness: nullableRatio,
    fieldCompleteness: fieldRecord(nullableRatio),
    dhis2UploadRate: nullableRatio,
});

export const deviceRowSchema = z.object({
    deviceId: z.number(),
    ssaid: z.string().nullable(),
    model: z.string(),
    programId: z.number(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'NEVER_USED']),
    position: z
        .object({ latitude: z.number(), longitude: z.number() })
        .nullable(),
    lastSubmittedAt: z.number().nullable(),
});

export const dashboardSchema = z.object({
    programs: z.array(programSchema),
    selectedProgramIds: z.array(z.number()),
    failedProgramIds: z.array(z.number()),
    metrics: z.object({
        months: z.array(monthKeySchema),
        programs: z.array(
            z.object({
                programId: z.number(),
                hasCountryBox: z.boolean(),
                months: z.record(z.string(), monthMetricsSchema),
                cycleLabels: z.record(z.string(), z.array(z.number())),
            }),
        ),
        totals: z.record(z.string(), monthMetricsSchema),
    }),
    deviceMonth: monthKeySchema,
    specimenPoints: z.object({
        placed: z.array(
            z.object({
                sessionId: z.number(),
                programId: z.number(),
                deviceId: z.number(),
                latitude: z.number(),
                longitude: z.number(),
                specimenCount: z.number(),
                collectedAt: z.number(),
            }),
        ),
        unplacedSessions: z.number(),
        unplacedSpecimens: z.number(),
    }),
    devices: z.array(deviceRowSchema),
    /** Oldest snapshot fetch time among loaded Programs; null if none loaded. */
    lastUpdatedAt: z.number().nullable(),
});

export const getDashboardResponseSchema = resultSchema(dashboardSchema);

export type Dashboard = z.infer<typeof dashboardSchema>;
export type MonthMetricsDto = z.infer<typeof monthMetricsSchema>;
