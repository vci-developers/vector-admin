import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProgressSnapshot } from './load-progress-snapshot';

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

function page(
    url: URL,
    key: string,
    total: number,
    row: (id: number) => unknown,
) {
    const offset = Number(url.searchParams.get('offset'));
    const count = Math.max(0, Math.min(100, total - offset));
    return json({
        [key]: Array.from({ length: count }, (_, index) => row(offset + index)),
        total,
    });
}

function healthyApi(url: URL): Response {
    if (url.pathname === '/sessions/')
        return page(url, 'sessions', 205, id => ({
            sessionId: id,
            siteId: 1,
            type: id === 3 ? '' : 'SURVEILLANCE',
            collectorName: null,
            deviceId: id === 3 ? null : 20,
            collectionDate: null,
            submittedAt: 100,
            latitude: null,
            longitude: null,
        }));
    if (url.pathname === '/specimens/count/sessions')
        return json({
            sessions: [
                {
                    sessionId: 1,
                    specimenCount: 105,
                    imageCount: 210,
                    groups: [
                        {
                            species: 'Anopheles',
                            sex: 'F',
                            abdomenStatus: null,
                            count: 105,
                        },
                    ],
                },
            ],
        });
    if (url.pathname === '/sites/')
        return page(url, 'sites', 1, siteId => ({
            siteId,
            name: null,
            district: 'Gulu',
            locationHierarchy: {},
        }));
    return json({ collectionCycles: [] });
}

function stubApi(
    handler: (url: URL) => Response | Promise<Response> = healthyApi,
) {
    const mock = vi.fn(async (input: string, init?: RequestInit) => {
        void init;
        return handler(new URL(input));
    });
    vi.stubGlobal('fetch', mock);
    return mock;
}

beforeEach(() => vi.stubEnv('ADMIN_AUTH_TOKEN', 'test-admin-token'));
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('loadProgressSnapshot', () => {
    it('does not require usable session GPS to load collection-site reporting data', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (url.pathname !== '/sessions/') return response;
            const body = await response.json();
            body.sessions = body.sessions.map(
                (session: Record<string, unknown>, index: number) => ({
                    ...session,
                    latitude:
                        index === 0 ? 'not a collection location' : undefined,
                    longitude: index === 0 ? {} : undefined,
                }),
            );
            return json(body);
        });
        const result = await loadProgressSnapshot(7);
        if (!result.ok)
            throw new Error('Expected site-based snapshot loading to succeed');

        expect(result.data.sessions).toHaveLength(205);
        expect(result.data.sessions[0].siteId).toBe(1);
        expect(result.data.sessions[0].latitude).toBeNull();
        expect(result.data.sessions[1].latitude).toBeUndefined();
        expect(result.data.sites[0].district).toBe('Gulu');
        expect(result.data.specimenCounts).toHaveLength(1);
    });

    it('loads every page and tolerates nullable collector names and legacy session types', async () => {
        const fetchMock = stubApi();
        const result = await loadProgressSnapshot(7);
        expect(result.ok && result.data.sessions).toHaveLength(205);
        if (!result.ok) throw new Error('Expected a successful snapshot');
        expect(result.data.sessions[3].type).toBe('');
        expect(result.data.sessions[0]).not.toHaveProperty('collectorName');
        expect(result.data.sessions[0].deviceId).toBe(20);
        expect(result.data.sessions[3].deviceId).toBeNull();
        expect(result.data.specimenCounts).toEqual([
            {
                sessionId: 1,
                specimenCount: 105,
                imageCount: 210,
                groups: [{ species: 'Anopheles', count: 105 }],
            },
        ]);
        const sessionOffsets = fetchMock.mock.calls
            .map(([input]) => new URL(input))
            .filter(url => url.pathname === '/sessions/')
            .map(url => url.searchParams.get('offset'));
        expect(sessionOffsets).toEqual(['0', '100', '200']);
    });

    it('reads only needed endpoints with stable sorting, image-backed specimen counts and every session type', async () => {
        const fetchMock = stubApi();
        await loadProgressSnapshot(7);
        for (const [input, init] of fetchMock.mock.calls) {
            const url = new URL(input);
            expect(init?.method).toBe('GET');
            expect(init?.headers).toMatchObject({
                Authorization: 'Bearer test-admin-token',
            });
            expect(url.pathname).not.toMatch(/devices|auth-events/);
            if (url.pathname === '/specimens/count/sessions') {
                expect(url.searchParams.get('programId')).toBe('7');
                expect(url.searchParams.get('hasImages')).toBe('true');
            } else if (!url.pathname.endsWith('collection-cycles')) {
                expect(url.searchParams.get('sortBy')).toBe('id');
                expect(url.searchParams.get('sortOrder')).toBe('asc');
            }
            // Session types are chosen per request in the builder.
            expect(url.searchParams.has('type')).toBe(false);
            expect(url.searchParams.has('sessionType')).toBe(false);
        }
    });

    it('refuses a partial snapshot when a later page fails', async () => {
        stubApi(url =>
            url.pathname === '/sessions/' &&
            url.searchParams.get('offset') === '100'
                ? json({ error: 'Page unavailable' }, 503)
                : healthyApi(url),
        );
        expect(await loadProgressSnapshot(7)).toEqual({
            ok: false,
            error: { kind: 'server', status: 503, message: 'Page unavailable' },
        });
    });

    it('refuses repeated numeric ids across page boundaries instead of silently undercounting', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (
                url.pathname !== '/sessions/' ||
                url.searchParams.get('offset') !== '100'
            ) {
                return response;
            }
            const body = await response.json();
            body.sessions[0].sessionId = 99;
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server', status: 502 },
        });
    });

    it('refuses repeated ids within a page', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (
                url.pathname !== '/sessions/' ||
                url.searchParams.get('offset') !== '0'
            )
                return response;
            const body = await response.json();
            body.sessions[1].sessionId = body.sessions[0].sessionId;
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server', status: 502 },
        });
    });

    it('refuses a successful but truncated final page', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (
                url.pathname !== '/sessions/' ||
                url.searchParams.get('offset') !== '200'
            )
                return response;
            const body = await response.json();
            body.sessions.pop();
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server', status: 502 },
        });
    });

    it('refuses advertised totals that change between pages', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (
                url.pathname !== '/sessions/' ||
                url.searchParams.get('offset') !== '100'
            )
                return response;
            const body = await response.json();
            body.total += 1;
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server', status: 502 },
        });
    });

    it('refuses first-page rows that disagree with an advertised zero total', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (url.pathname !== '/sites/') return response;
            const body = await response.json();
            body.total = 0;
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server', status: 502 },
        });
    });

    it('accepts a genuinely empty resource', async () => {
        stubApi(url =>
            url.pathname === '/specimens/count/sessions'
                ? json({ sessions: [] })
                : healthyApi(url),
        );
        const result = await loadProgressSnapshot(7);
        expect(result.ok && result.data.specimenCounts).toEqual([]);
    });

    it('refuses a snapshot when a session count omits its image count', async () => {
        stubApi(async url => {
            const response = healthyApi(url);
            if (url.pathname !== '/specimens/count/sessions') return response;
            const body = await response.json();
            delete body.sessions[0].imageCount;
            return json(body);
        });
        expect(await loadProgressSnapshot(7)).toEqual({
            ok: false,
            error: { kind: 'client' },
        });
    });

    it('shares a cold load between concurrent requests', async () => {
        const fetchMock = stubApi();
        const [first, second] = await Promise.all([
            loadProgressSnapshot(7),
            loadProgressSnapshot(7),
        ]);
        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('does not call the API without the server admin token', async () => {
        vi.stubEnv('ADMIN_AUTH_TOKEN', '');
        const fetchMock = stubApi();
        expect(await loadProgressSnapshot(7)).toMatchObject({
            ok: false,
            error: { kind: 'server' },
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
