import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProgramSnapshot } from './load-program-snapshot';

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

type Handler = (url: URL) => Response;

function stubApi(handler: Handler) {
    const fetchMock = vi.fn<
        (input: string, init?: RequestInit) => Promise<Response>
    >(async input => handler(new URL(input)));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

const session = (sessionId: number) => ({
    sessionId,
    deviceId: 1,
    siteId: 1,
    type: 'SURVEILLANCE',
    state: 'CERTIFIED',
    collectorName: 'A',
    collectionDate: 0,
    createdAt: 0,
    submittedAt: 0,
    latitude: null,
    longitude: null,
});

function page(
    url: URL,
    key: string,
    total: number,
    make: (i: number) => unknown,
) {
    const offset = Number(url.searchParams.get('offset'));
    const limit = Number(url.searchParams.get('limit'));
    const items = Array.from(
        { length: Math.max(0, Math.min(limit, total - offset)) },
        (_, i) => make(offset + i),
    );
    return json({ [key]: items, total });
}

function healthyApi(url: URL): Response {
    if (url.pathname === '/sessions/')
        return page(url, 'sessions', 250, session);
    if (url.pathname === '/specimens/')
        return page(url, 'specimens', 0, () => null);
    if (url.pathname === '/devices/')
        return page(url, 'devices', 0, () => null);
    return json({ collectionCycles: [] });
}

beforeEach(() => vi.stubEnv('ADMIN_AUTH_TOKEN', 'admin-token'));
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('loadProgramSnapshot', () => {
    it('follows every page of a resource', async () => {
        stubApi(healthyApi);
        const result = await loadProgramSnapshot(7);
        expect(result.ok && result.data.sessions.map(s => s.sessionId)).toEqual(
            Array.from({ length: 250 }, (_, i) => i),
        );
    });

    it('fails the whole snapshot when one page fails', async () => {
        stubApi(url =>
            url.pathname === '/sessions/' &&
            url.searchParams.get('offset') === '100'
                ? json({ error: 'boom' }, 500)
                : healthyApi(url),
        );
        expect(await loadProgramSnapshot(7)).toEqual({
            ok: false,
            error: { kind: 'server', status: 500, message: 'boom' },
        });
    });

    it('only sends GET requests with the admin token', async () => {
        const fetchMock = stubApi(healthyApi);
        await loadProgramSnapshot(7);
        for (const [, init] of fetchMock.mock.calls) {
            expect(init?.method).toBe('GET');
            expect(init?.headers).toMatchObject({
                Authorization: 'Bearer admin-token',
            });
        }
    });

    it('refuses to call the API without an admin token', async () => {
        vi.stubEnv('ADMIN_AUTH_TOKEN', '');
        const fetchMock = stubApi(healthyApi);
        const result = await loadProgramSnapshot(7);
        expect(result).toMatchObject({ ok: false, error: { kind: 'server' } });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
