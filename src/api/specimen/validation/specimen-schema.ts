import { z } from 'zod';

export const specimenSchema = z.object({
    id: z.number(),
    sessionId: z.number(),
    images: z.array(z.object({ id: z.number() })).default([]),
    thumbnailImage: z.object({ species: z.string().nullish() }).nullable(),
});

export const getSpecimensPageSchema = z
    .object({ specimens: z.array(specimenSchema), total: z.number() })
    .transform(page => ({ items: page.specimens, total: page.total }));

export type Specimen = z.infer<typeof specimenSchema>;
