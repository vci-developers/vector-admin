import { ok } from '@/lib/result/result';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeveloper, withViewer } from './with-viewer';

let accessToken: string | undefined;
vi.mock('next/headers', () => ({
    cookies: async () => ({
        get: () => (accessToken ? { value: accessToken } : undefined),
    }),
}));

function stubPermissions(
    status: number,
    body: unknown,
    email = 'someone@example.org',
) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL) =>
            String(url).includes('/users/profile')
                ? new Response(JSON.stringify({ user: { email } }))
                : new Response(JSON.stringify(body), { status }),
        ),
    );
}

const loadData = async () => ok('admin data');

afterEach(() => {
    accessToken = undefined;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

    it('passes a Developer to the callback', async () => {
        accessToken = 'dev-token';
        stubPermissions(200, { permissions: { devMode: true } });
        const callback = vi.fn(async () => ok(null));
        await withViewer(callback);
        expect(callback).toHaveBeenCalledWith({ role: 'developer' });
    });

    it('runs the callback for a listed Stakeholder with their Programs', async () => {
        accessToken = 'stakeholder-token';
        vi.stubEnv('STAKEHOLDER_EMAILS', 'partner@who.int:1|4');
        stubPermissions(
            200,
            { permissions: { devMode: false } },
            'Partner@WHO.int',
        );
        const callback = vi.fn(async () => ok(null));
        await withViewer(callback);
        expect(callback).toHaveBeenCalledWith({
            role: 'stakeholder',
            programIds: [1, 4],
        });
    });

    it('refuses everyone but Developers when the list is malformed', async () => {
        accessToken = 'stakeholder-token';
        vi.stubEnv('STAKEHOLDER_EMAILS', 'partner@who.int:1,oops');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        stubPermissions(
            200,
            { permissions: { devMode: false } },
            'partner@who.int',
        );
        expect(await withViewer(loadData)).toMatchObject({
            ok: false,
            error: { kind: 'forbidden' },
        });
    });
});

describe('withDeveloper', () => {
    it('refuses a Stakeholder', async () => {
        accessToken = 'stakeholder-token';
        vi.stubEnv('STAKEHOLDER_EMAILS', 'partner@who.int:1');
        stubPermissions(
            200,
            { permissions: { devMode: false } },
            'partner@who.int',
        );
        expect(await withDeveloper(loadData)).toMatchObject({
            ok: false,
            error: { kind: 'forbidden' },
        });
    });

    it('runs the callback for a Developer', async () => {
        accessToken = 'dev-token';
        stubPermissions(200, { permissions: { devMode: true } });
        expect(await withDeveloper(loadData)).toEqual(ok('admin data'));
    });
});
