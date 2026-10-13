import { z } from 'zod';

// Donor figures do not need collector identities, devices, image predictions,
// or review states. Nullable collector names and legacy empty types therefore
// cannot invalidate otherwise usable reporting data.
export const progressSessionSchema = z.object({
    sessionId: z.number(),
    siteId: z.number(),
    // Used only by the Excel's internal metrics; never sent in the progress DTO.
    deviceId: z.number().nullish(),
    type: z
        .string()
        .nullish()
        .transform(value => value ?? ''),
    collectionDate: z.number().nullable(),
    submittedAt: z.number(),
    // Session GPS is not the collection-site location. Preserve compatible
    // snapshots without requiring usable GPS for donor counts or placement.
    latitude: z.number().nullish().catch(null),
    longitude: z.number().nullish().catch(null),
});

export const progressSessionsPageSchema = z
    .object({ sessions: z.array(progressSessionSchema), total: z.number() })
    .transform(page => ({ items: page.sessions, total: page.total }));

// Counted by the API per Session, so no specimen or image pages are crawled.
// Each image is one scan; groups carry the current species (the app's
// prediction, or a reviewer's correction).
const countSchema = z.number().int().nonnegative();

export const progressSessionCountSchema = z.object({
    sessionId: z.number(),
    specimenCount: countSchema,
    imageCount: countSchema,
    groups: z.array(
        z.object({ species: z.string().nullish(), count: countSchema }),
    ),
});

export const progressSessionCountsSchema = z
    .object({ sessions: z.array(progressSessionCountSchema) })
    .transform(response => response.sessions);

export type ProgressSession = z.infer<typeof progressSessionSchema>;
export type ProgressSessionCount = z.infer<typeof progressSessionCountSchema>;
