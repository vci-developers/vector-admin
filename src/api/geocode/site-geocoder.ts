import type { NetworkError } from '@/lib/network/network-error';
import type { Result } from '@/lib/result/result';
import { isInsideCountry } from '@/features/dashboard/utils/country-bounding-boxes';
import { fallbackQueries } from '@/features/dashboard/utils/site-location-query';

export type Point = { latitude: number; longitude: number };

export type SiteLookup = { key: string; query: string; country: string };

type Search = (
    query: string,
    country: string,
) => Promise<Result<Point | null, NetworkError>>;

/**
 * Geocodes Sites one request at a time in the background (Nominatim allows one
 * per second) and keeps answers in memory; callers get what is known now and
 * which keys are still pending. A match outside the Program's country is
 * rejected and the next, broader query is tried. Errors are not cached, so a
 * later lookup retries them.
 */
export function createSiteGeocoder({
    search,
    delayMs,
}: {
    search: Search;
    delayMs: number;
}) {
    const results = new Map<string, Point | null>();
    const queue: SiteLookup[] = [];
    const queued = new Set<string>();
    let running: Promise<void> | null = null;
    let lastRequestAt = 0;

    async function rateLimitedSearch(query: string, country: string) {
        const wait = lastRequestAt + delayMs - Date.now();
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        lastRequestAt = Date.now();
        return search(query, country);
    }

    async function resolve({
        query,
        country,
    }: SiteLookup): Promise<Point | null | undefined> {
        for (const candidate of fallbackQueries(query)) {
            // A bare country name would drop every Site on the country's centre.
            if (candidate === country) break;
            const result = await rateLimitedSearch(candidate, country);
            if (!result.ok) return undefined;
            const point = result.data;
            if (
                point &&
                isInsideCountry(point.latitude, point.longitude, country)
            ) {
                return point;
            }
        }
        return null;
    }

    async function drain() {
        while (queue.length > 0) {
            const job = queue.shift()!;
            const point = await resolve(job);
            if (point !== undefined) results.set(job.key, point);
            queued.delete(job.key);
        }
        running = null;
    }

    return {
        lookup(requests: SiteLookup[]) {
            const resolved = new Map<string, Point | null>();
            const pending: string[] = [];
            for (const request of requests) {
                if (results.has(request.key)) {
                    resolved.set(request.key, results.get(request.key) ?? null);
                    continue;
                }
                pending.push(request.key);
                if (!queued.has(request.key)) {
                    queued.add(request.key);
                    queue.push(request);
                }
            }
            if (queue.length > 0 && !running) running = drain();
            return { resolved, pending };
        },
        /** Resolves once the queue is empty. */
        idle: () => running ?? Promise.resolve(),
    };
}
