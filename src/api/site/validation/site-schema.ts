import { z } from 'zod';

export const siteSchema = z.object({
    siteId: z.number(),
    name: z.string().nullable(),
    district: z.string().nullish(),
    subCounty: z.string().nullish(),
    parish: z.string().nullish(),
    villageName: z.string().nullish(),
    // Keeps only string levels; the backend stores free-form JSON here.
    locationHierarchy: z
        .record(z.string(), z.unknown())
        .nullish()
        .transform(hierarchy =>
            Object.fromEntries(
                Object.entries(hierarchy ?? {}).filter(
                    (entry): entry is [string, string] =>
                        typeof entry[1] === 'string',
                ),
            ),
        ),
});

export const getSitesPageSchema = z
    .object({ sites: z.array(siteSchema), total: z.number() })
    .transform(page => ({ items: page.sites, total: page.total }));

export type Site = z.infer<typeof siteSchema>;
