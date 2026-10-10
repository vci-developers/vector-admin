import 'server-only';

import {
    adminGet,
    type AdminEndpoint,
    type AdminQuery,
} from '@/api/admin/admin-client';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';
import type { z } from 'zod';

const PAGE_SIZE = 100;
const CONCURRENT_PAGES = 15;
type Page<T> = { items: T[]; total: number };

/**
 * Donor totals require a complete set of distinct records. Offset pagination
 * can shift when records are uploaded between pages, so ambiguous results are
 * rejected rather than silently deduplicated into a complete-looking count.
 */
export async function loadProgressPages<T>(
    endpoint: AdminEndpoint,
    query: AdminQuery,
    schema: z.ZodType<Page<T>>,
    idOf: (row: T) => number,
): Promise<Result<T[], NetworkError>> {
    const getPage = (offset: number) =>
        adminGet(endpoint, { ...query, limit: PAGE_SIZE, offset }, schema);
    const incomplete = () =>
        err({
            kind: 'server' as const,
            status: 502,
            message: `VectorCam returned incomplete or changing ${endpoint} pages. Please try again.`,
        });

    const first = await getPage(0);
    if (!first.ok) return first;
    const total = first.data.total;
    if (!Number.isSafeInteger(total) || total < 0) return incomplete();

    const seen = new Set<number>();
    function accept(page: Page<T>, offset: number): boolean {
        if (
            page.total !== total ||
            page.items.length !== Math.min(PAGE_SIZE, total - offset)
        )
            return false;
        for (const row of page.items) {
            const id = idOf(row);
            if (seen.has(id)) return false;
            seen.add(id);
        }
        return true;
    }

    if (!accept(first.data, 0)) return incomplete();
    const items = [...first.data.items];
    for (
        let offset = PAGE_SIZE;
        offset < total;
        offset += PAGE_SIZE * CONCURRENT_PAGES
    ) {
        const offsets = Array.from(
            { length: CONCURRENT_PAGES },
            (_, index) => offset + index * PAGE_SIZE,
        ).filter(pageOffset => pageOffset < total);
        const pages = await Promise.all(offsets.map(getPage));
        for (const [index, page] of pages.entries()) {
            if (!page.ok) return page;
            if (!accept(page.data, offsets[index])) return incomplete();
            items.push(...page.data.items);
        }
    }
    return items.length === total ? ok(items) : incomplete();
}
