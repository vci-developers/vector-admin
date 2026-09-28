import 'server-only';

import type { NetworkError } from '@/lib/network/network-error';
import { safeApiCall } from '@/lib/network/safe-api-call';
import { err, ok, type Result } from '@/lib/result/result';
import type { z } from 'zod';

// The admin token can write anything; this allowlist is the only way to use it.
export type AdminEndpoint =
    | '/programs'
    | '/sessions/'
    | '/specimens/'
    | '/devices/'
    | '/users/auth-events'
    | `/programs/${number}/collection-cycles`;

export type AdminQuery = Record<string, string | number | boolean>;

type Page<T> = { items: T[]; total: number };

const PAGE_SIZE = 100;
// Bounded so a cold load doesn't flood the API.
const CONCURRENT_PAGES = 5;

export async function adminGet<T>(
    endpoint: AdminEndpoint,
    query: AdminQuery,
    schema: z.ZodType<T>,
): Promise<Result<T, NetworkError>> {
    const adminToken = process.env.ADMIN_AUTH_TOKEN;
    if (!adminToken) {
        return err({ kind: 'server', message: 'ADMIN_AUTH_TOKEN is not set' });
    }

    const queryString = new URLSearchParams(
        Object.entries(query).map(([key, value]) => [key, String(value)]),
    ).toString();

    return safeApiCall<T>(
        queryString ? `${endpoint}?${queryString}` : endpoint,
        {
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` },
        },
        schema,
    );
}

export async function adminGetAll<T>(
    endpoint: AdminEndpoint,
    query: AdminQuery,
    pageSchema: z.ZodType<Page<T>>,
): Promise<Result<T[], NetworkError>> {
    const getPage = (offset: number) =>
        adminGet(endpoint, { ...query, limit: PAGE_SIZE, offset }, pageSchema);

    const first = await getPage(0);
    if (!first.ok) return first;

    const items = [...first.data.items];
    for (
        let offset = PAGE_SIZE;
        offset < first.data.total;
        offset += PAGE_SIZE * CONCURRENT_PAGES
    ) {
        const batchOffsets = Array.from(
            { length: CONCURRENT_PAGES },
            (_, i) => offset + i * PAGE_SIZE,
        ).filter(batchOffset => batchOffset < first.data.total);
        const pages = await Promise.all(batchOffsets.map(getPage));

        for (const page of pages) {
            if (!page.ok) return page;
            items.push(...page.data.items);
        }
    }

    return ok(items);
}
