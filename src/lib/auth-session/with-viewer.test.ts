import { ok } from '@/lib/result/result';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withViewer } from './with-viewer';

let accessToken: string | undefined;
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => (accessToken ? { value: accessToken } : undefined),
    }),
}));

function stubPermissions(status: number, body: unknown) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );
}

const loadData = async () => ok('admin data');

afterEach(() => {
    accessToken = undefined;
    vi.unstubAllGlobals();
});

describe('withViewer', () => {
    it('returns unauthorized without an access cookie', async () => {
        const result = await withViewer(loadData);
        expect(result).toMatchObject({
            ok: false,
            error: { kind: 'unauthorized' },
        });
    });

    it('refuses a signed-in user without developer access', async () => {
        accessToken = 'user-token';
        stubPermissions(200, { permissions: { devMode: false } });
        const result = await withViewer(loadData);
        expect(result).toMatchObject({
            ok: false,
            error: { kind: 'forbidden' },
        });
    });

    it('passes through a permissions failure', async () => {
        accessToken = 'expired-token';
        stubPermissions(401, { error: 'Invalid token' });
        const result = await withViewer(loadData);
        expect(result).toMatchObject({
            ok: false,
            error: { kind: 'unauthorized' },
        });
    });

    it('runs the callback for a developer', async () => {
        accessToken = 'dev-token';
        stubPermissions(200, { permissions: { devMode: true } });
        expect(await withViewer(loadData)).toEqual(ok('admin data'));
    });
});
