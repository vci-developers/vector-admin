import { resultSchema } from '@/lib/result/result-schema';
import { z } from 'zod';

const idListSchema = z
    .string()
    .regex(/^(\d+(,\d+)*)?$/)
    .transform(value => (value === '' ? [] : value.split(',').map(Number)));

export const getSiteLocationsQuerySchema = z.object({
    exclude: idListSchema.default([]),
    siteIds: idListSchema,
});

export type GetSiteLocationsQuery = z.infer<typeof getSiteLocationsQuerySchema>;

export const siteLocationsSchema = z.object({
    /** Keyed by siteId; null when the Site could not be geocoded in-country. */
    locations: z.record(
        z.string(),
        z
            .object({
                latitude: z.number(),
                longitude: z.number(),
                /** The place name that matched, e.g. "Bukatube, Mayuge, Uganda". */
                query: z.string(),
            })
            .nullable(),
    ),
    pending: z.array(z.number()),
});

export const getSiteLocationsResponseSchema = resultSchema(siteLocationsSchema);

export type SiteLocations = z.infer<typeof siteLocationsSchema>;
