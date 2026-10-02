import { z } from 'zod';

export const sessionStateSchema = z.enum([
    'NEEDS_REVIEW',
    'IN_REVIEW',
    'CERTIFIED',
    'SUBMITTED',
    'NOT_APPLICABLE',
]);

export const sessionTypeSchema = z.enum([
    'SURVEILLANCE',
    'DATA_COLLECTION',
    'PRACTICE',
    'CALIBRATION',
]);

// Only the fields the metrics read; zod strips the rest to keep snapshots small.
export const sessionSchema = z.object({
    sessionId: z.number(),
    deviceId: z.number(),
    siteId: z.number(),
    type: sessionTypeSchema,
    state: sessionStateSchema.optional(),
    collectorName: z.string(),
    collectorTitle: z.string().nullish(),
    collectionDate: z.number().nullable(),
    createdAt: z.number().nullable(),
    submittedAt: z.number(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
});

export const getSessionsPageSchema = z
    .object({ sessions: z.array(sessionSchema), total: z.number() })
    .transform(page => ({ items: page.sessions, total: page.total }));

export type Session = z.infer<typeof sessionSchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type SessionType = z.infer<typeof sessionTypeSchema>;
