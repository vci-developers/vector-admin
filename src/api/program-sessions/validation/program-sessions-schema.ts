import { sessionStateSchema } from '@/api/session/validation/session-schema';
import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

export const getProgramSessionsQuerySchema = z.object({
    programId: z.coerce.number().int().positive(),
    from: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    to: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
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
