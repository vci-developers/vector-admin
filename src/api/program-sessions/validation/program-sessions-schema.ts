import {
    locationLevelSchema,
    sessionScopeQuerySchema,
} from '@/api/dashboard/validation/dashboard-schema';
import { sessionStateSchema } from '@/api/session/validation/session-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

export const getProgramSessionsQuerySchema = z.object({
    programId: z.coerce.number().int().positive(),
    from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    to: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    ...sessionScopeQuerySchema.shape,
});

export type GetProgramSessionsQuery = z.infer<
    typeof getProgramSessionsQuerySchema
>;

export const programMonthSessionSchema = z.object({
    sessionId: z.number(),
    state: sessionStateSchema.nullable(),
    isCertified: z.boolean(),
    deviceId: z.number(),
    siteId: z.number(),
    siteName: z.string().nullable(),
    location: z.array(locationLevelSchema),
    collectorName: z.string(),
    collectorTitle: z.string().nullable(),
    createdAt: z.number().nullable(),
    collectionDate: z.number().nullable(),
    submittedAt: z.number(),
    specimenCount: z.number(),
    handling: z.object({
        images: z.number(),
        gaps: z.array(z.number()),
    }),
    missing: z.object({
        species: z.number(),
        captureDate: z.boolean(),
        geolocation: z.boolean(),
        operatorId: z.boolean(),
    }),
});

export const programSessionsSchema = z.object({
    programId: z.number(),
    from: z.string(),
    to: z.string(),
    sessions: z.array(programMonthSessionSchema),
});

export const getProgramSessionsResponseSchema = resultSchema(
    programSessionsSchema,
);

export type ProgramSessions = z.infer<typeof programSessionsSchema>;
