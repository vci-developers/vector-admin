import { sessionStateSchema } from '@/api/session/validation/session-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

export const getProgramMonthSessionsQuerySchema = z.object({
    programId: z.coerce.number().int().positive(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export type GetProgramMonthSessionsQuery = z.infer<
    typeof getProgramMonthSessionsQuerySchema
>;

export const programMonthSessionSchema = z.object({
    sessionId: z.number(),
    state: sessionStateSchema.nullable(),
    isCertified: z.boolean(),
    deviceId: z.number(),
    siteId: z.number(),
    collectionDate: z.number().nullable(),
    submittedAt: z.number(),
    timeToConfirmation: z.number().nullable(),
    specimenCount: z.number(),
    missing: z.object({
        species: z.number(),
        captureDate: z.boolean(),
        geolocation: z.boolean(),
        operatorId: z.boolean(),
    }),
});

export const programMonthSessionsSchema = z.object({
    programId: z.number(),
    month: z.string(),
    sessions: z.array(programMonthSessionSchema),
});

export const getProgramMonthSessionsResponseSchema = resultSchema(
    programMonthSessionsSchema,
);

export type ProgramMonthSessions = z.infer<typeof programMonthSessionsSchema>;
