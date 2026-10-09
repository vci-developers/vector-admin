import 'server-only';

import { err, ok, type Result } from '@/lib/result/result';
import { get, put } from '@vercel/blob';
import { createHash } from 'node:crypto';

/**
 * The most recent workbook that loaded and validated, kept in the project's
 * private Vercel Blob store so every instance, and every later deploy, can
 * fall back to it when SharePoint is down.
 */
const PATHNAME = 'coverage/latest.xlsx';

/** What this instance knows the store holds; null until it has looked. */
let storedHash: string | null = null;

const hasStore = () =>
    Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const hashOf = (file: ArrayBuffer) =>
    createHash('sha256').update(Buffer.from(file)).digest('hex');

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

export async function readLastGoodWorkbook(): Promise<
    Result<{ file: ArrayBuffer; savedAt: number }, string>
> {
    if (!hasStore()) return err('No blob store configured');
    try {
        // From origin, not the CDN, so an overwrite is seen at once.
        const stored = await get(PATHNAME, {
            access: 'private',
            useCache: false,
        });
        if (!stored || stored.statusCode !== 200)
            return err('No workbook stored yet');
        const file = await new Response(stored.stream).arrayBuffer();
        storedHash = hashOf(file);
        return ok({ file, savedAt: stored.blob.uploadedAt.getTime() });
    } catch (error) {
        return err(messageOf(error));
    }
}

/**
 * Stores a workbook that just loaded, unless the store already holds it. A
 * failure only means the fallback lags; the live figures are unaffected.
 */
export async function storeLastGoodWorkbook(file: ArrayBuffer): Promise<void> {
    if (!hasStore()) return;
    const hash = hashOf(file);
    if (hash === storedHash) return;
    // A fresh instance checks the store once before writing over it.
    if (storedHash === null) {
        await readLastGoodWorkbook();
        if (hash === storedHash) return;
    }
    try {
        await put(PATHNAME, Buffer.from(file), {
            access: 'private',
            allowOverwrite: true,
            addRandomSuffix: false,
            contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            cacheControlMaxAge: 60,
        });
        storedHash = hash;
    } catch (error) {
        console.error(
            `Coverage workbook not stored as the fallback: ${messageOf(error)}`,
        );
    }
}
