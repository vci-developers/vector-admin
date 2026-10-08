import 'server-only';

import {
    describeCoverageError,
    type CoverageFigures,
} from '@/features/dashboard/utils/parse-coverage-sheets';
import { err, ok, type Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';
import savedCopy from './coverage-saved-copy.json';
import { readCoverageWorkbook } from './read-coverage-workbook';

export const COVERAGE_TAG = 'coverage';

export type LoadedCoverage = {
    figures: CoverageFigures;
    /** 'saved' when SharePoint failed and the committed copy is shown. */
    source: 'live' | 'saved';
    /** When the committed copy was saved; null for live figures. */
    savedAt: number | null;
    /** Why the live workbook wasn't used; null when it was. */
    liveProblem: string | null;
};

const MAX_REDIRECTS = 6;

/**
 * SharePoint "Anyone" links answer with a cookie and a redirect, then 401
 * without the cookie, so redirects are followed by hand carrying cookies.
 */
async function fetchSharedFile(
    link: string,
): Promise<Result<ArrayBuffer, string>> {
    const url = new URL(link);
    url.searchParams.set('download', '1');
    const cookies = new Map<string, string>();
    let current = url.href;

    try {
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            const response = await fetch(current, {
                redirect: 'manual',
                headers: {
                    cookie: [...cookies]
                        .map(([k, v]) => `${k}=${v}`)
                        .join('; '),
                },
                signal: AbortSignal.timeout(15_000),
            });
            for (const cookie of response.headers.getSetCookie()) {
                const [pair] = cookie.split(';');
                const split = pair.indexOf('=');
                if (split > 0)
                    cookies.set(pair.slice(0, split), pair.slice(split + 1));
            }
            const location = response.headers.get('location');
            if (response.status >= 300 && response.status < 400 && location) {
                current = new URL(location, current).href;
                continue;
            }
            if (!response.ok)
                return err(`SharePoint answered ${response.status}`);
            const type = response.headers.get('content-type') ?? '';
            if (type.includes('text/html'))
                return err(
                    'The link returned a web page, not the workbook (password set, or link expired?)',
                );
            return ok(await response.arrayBuffer());
        }
        return err('Too many redirects from SharePoint');
    } catch (error) {
        return err(
            error instanceof Error
                ? error.message
                : 'Could not reach SharePoint',
        );
    }
}

async function loadLive(): Promise<Result<CoverageFigures, string>> {
    const link = process.env.COVERAGE_WORKBOOK_URL;
    if (!link) return err('COVERAGE_WORKBOOK_URL is not set');

    const file = await fetchSharedFile(link);
    if (!file.ok) return file;
    const figures = await readCoverageWorkbook(file.data);
    return figures.ok
        ? figures
        : err(figures.error.map(describeCoverageError).join(' · '));
}

/**
 * The team's coverage workbook from SharePoint, or the committed copy when
 * SharePoint fails or the workbook is invalid. Errors only if both fail.
 */
export async function loadCoverage(): Promise<Result<LoadedCoverage, string>> {
    'use cache';
    cacheTag(COVERAGE_TAG);

    const live = await loadLive();
    if (live.ok) {
        cacheLife('hours');
        return ok({
            figures: live.data,
            source: 'live',
            savedAt: null,
            liveProblem: null,
        });
    }

    // Retry SharePoint soon; the saved copy holds until then.
    cacheLife('minutes');
    const saved = await readCoverageWorkbook(
        Uint8Array.from(Buffer.from(savedCopy.workbook, 'base64')).buffer,
    );
    if (!saved.ok) {
        return err(
            `${live.error}; saved copy: ${saved.error.map(describeCoverageError).join(' · ')}`,
        );
    }
    return ok({
        figures: saved.data,
        source: 'saved',
        savedAt: savedCopy.savedAt,
        liveProblem: live.error,
    });
}
