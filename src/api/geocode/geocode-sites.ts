import 'server-only';

import { countryCode } from '@/features/dashboard/utils/country-bounding-boxes';
import { safeApiCall } from '@/lib/network/safe-api-call';
import { ok } from '@/lib/result/result';
import { z } from 'zod';
import { createSiteGeocoder } from './site-geocoder';

const nominatimResponseSchema = z.array(
    z.object({ lat: z.coerce.number(), lon: z.coerce.number() }),
);

// One process-wide geocoder so the rate limit and cache are shared by every
// request. In-memory: a restart re-geocodes in the background.
export const siteGeocoder = createSiteGeocoder({
    delayMs: 1100,
    search: async (query, country) => {
        const code = countryCode(country);
        const params = new URLSearchParams({
            q: query,
            format: 'json',
            limit: '1',
            ...(code ? { countrycodes: code } : {}),
        });
        const result = await safeApiCall(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
                headers: {
                    'User-Agent':
                        'VectorAdmin/1.0 (CBID surveillance monitoring)',
                    'Accept-Language': 'en',
                },
            },
            nominatimResponseSchema,
        );
        if (!result.ok) return result;
        const match = result.data[0];
        return ok(match ? { latitude: match.lat, longitude: match.lon } : null);
    },
});
