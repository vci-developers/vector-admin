import { z } from 'zod';

export const specimenSchema = z.object({
    id: z.number(),
    sessionId: z.number(),
    // capturedAt: when the phone took the image, for Handling Time.
    images: z
        .array(z.object({ id: z.number(), capturedAt: z.number().nullish() }))
        .default([]),
    // Current values: the app's prediction at upload, replaced when a reviewer
    // corrects it. appSpecies… keep the app's original and are not used.
    thumbnailImage: z
        .object({
            species: z.string().nullish(),
            sex: z.string().nullish(),
            abdomenStatus: z.string().nullish(),
        })
        .nullable(),
});

export const getSpecimensPageSchema = z
    .object({ specimens: z.array(specimenSchema), total: z.number() })
    .transform(page => ({ items: page.specimens, total: page.total }));

export type Specimen = z.infer<typeof specimenSchema>;
