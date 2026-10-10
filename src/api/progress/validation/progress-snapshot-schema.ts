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
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
});

export const progressSessionsPageSchema = z
    .object({ sessions: z.array(progressSessionSchema), total: z.number() })
    .transform(page => ({ items: page.sessions, total: page.total }));

// Each image is one scan. Require the complete image list so a missing API
// field cannot silently turn a scanned specimen into zero scans. Image URLs,
// predictions and other metadata are not needed for the donor figures.
export const progressSpecimenSchema = z.object({
    id: z.number(),
    sessionId: z.number(),
    images: z.array(z.object({ id: z.number().int().nonnegative() })),
});

export const progressSpecimensPageSchema = z
    .object({ specimens: z.array(progressSpecimenSchema), total: z.number() })
    .transform(page => ({ items: page.specimens, total: page.total }));

export type ProgressSession = z.infer<typeof progressSessionSchema>;
export type ProgressSpecimen = z.infer<typeof progressSpecimenSchema>;
