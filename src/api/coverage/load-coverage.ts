import 'server-only';

import {
    describeCoverageError,
    type CoverageFigures,
} from '@/features/dashboard/utils/parse-coverage-sheets';
import { err, ok, type Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';
import savedCopy from './coverage-saved-copy.json';
import {
    readLastGoodWorkbook,
    storeLastGoodWorkbook,
} from './last-good-workbook';
import { readCoverageWorkbook } from './read-coverage-workbook';

export const COVERAGE_TAG = 'coverage';

export type LoadedCoverage = {
    figures: CoverageFigures;
    /**
     * 'saved' when SharePoint failed or the workbook was invalid: the last
     * good workbook is shown, or the committed copy before there is one.
     */
    source: 'live' | 'saved';
    /** When the shown copy was saved; null for live figures. */
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

async function loadLive(): Promise<
    Result<{ figures: CoverageFigures; file: ArrayBuffer }, string>
> {
    const link = process.env.COVERAGE_WORKBOOK_URL;
    if (!link) return err('COVERAGE_WORKBOOK_URL is not set');

    const file = await fetchSharedFile(link);
    if (!file.ok) return file;
    const figures = await readCoverageWorkbook(file.data);
    return figures.ok
        ? ok({ figures: figures.data, file: file.data })
        : err(figures.error.map(describeCoverageError).join(' · '));
}

/** The last good workbook from the blob store, if it is there and valid. */
async function loadLastGood(): Promise<
    Result<{ figures: CoverageFigures; savedAt: number }, string>
> {
    const stored = await readLastGoodWorkbook();
    if (!stored.ok) return stored;
    const figures = await readCoverageWorkbook(stored.data.file);
    return figures.ok
        ? ok({ figures: figures.data, savedAt: stored.data.savedAt })
        : err(figures.error.map(describeCoverageError).join(' · '));
}

/**
 * The team's coverage workbook from SharePoint, re-read every minute or so.
 * When SharePoint fails or the workbook is invalid: the last workbook that
 * loaded (kept in the blob store), else the committed copy. Errors only if
 * all three fail.
 */
export async function loadCoverage(): Promise<Result<LoadedCoverage, string>> {
    'use cache';
    cacheTag(COVERAGE_TAG);
    cacheLife('minutes');

    const live = await loadLive();
    if (live.ok) {
        await storeLastGoodWorkbook(live.data.file);
        return ok({
            figures: live.data.figures,
            source: 'live',
            savedAt: null,
            liveProblem: null,
        });
    }

    const lastGood = await loadLastGood();
    if (lastGood.ok) {
        return ok({
            figures: lastGood.data.figures,
            source: 'saved',
            savedAt: lastGood.data.savedAt,
            liveProblem: live.error,
        });
    }

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
