import { getDashboardProgramSelection } from '@/api/dashboard/get-default-excluded-programs';
import type { Program } from '@/api/program/validation/program-schema';
import ViewerGate from '@/features/auth/components/viewer-gate';
import AppHeader from '@/features/dashboard/components/app-header';
import DashboardProvider from '@/features/dashboard/components/dashboard-provider';
import { getViewAs } from '@/lib/auth-session/with-viewer';
import { Writable } from 'node:stream';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLayout from './layout';
import DashboardPage from './page';

vi.mock('@/api/dashboard/get-default-excluded-programs', () => ({
    getDashboardProgramSelection: vi.fn(),
}));
vi.mock('@/lib/auth-session/with-viewer', () => ({ getViewAs: vi.fn() }));
vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('next/image', () => ({
    default: ({
        src,
        alt,
        width,
        height,
        className,
    }: {
        src: string;
        alt: string;
        width: number;
        height: number;
        className?: string;
    }) => createElement('img', { src, alt, width, height, className }),
}));
vi.mock('@/features/dashboard/components/app-header', () => ({
    default: vi.fn(({ viewAs }: { viewAs: string | null }) =>
        createElement('header', {
            'data-authorized-header': viewAs ?? 'donor',
        }),
    ),
}));
vi.mock('@/features/dashboard/components/dashboard-provider', () => ({
    default: vi.fn(
        ({
            view,
            defaultExclude,
            programs,
            children,
        }: {
            view: string;
            defaultExclude: number[];
            programs: Program[];
            children: ReactNode;
        }) =>
            createElement(
                'section',
                {
                    'data-authorized-provider': view,
                    'data-default-exclusions': defaultExclude.join(','),
                },
                createElement(
                    'ul',
                    null,
                    ...programs.map(program =>
                        createElement(
                            'li',
                            { key: program.programId },
                            program.name,
                        ),
                    ),
                ),
                children,
            ),
    ),
}));
vi.mock('@/features/dashboard/components/dashboard-view', () => ({
    default: ({ view }: { view: string }) =>
        createElement(
            'p',
            { 'data-dashboard-view': view },
            'Authorized dashboard',
        ),
}));
vi.mock('@/features/auth/components/viewer-gate', () => ({ default: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>(fulfill => {
        resolve = fulfill;
    });
    return { promise, resolve };
}

const pendingStreams = new Set<ReturnType<typeof renderToPipeableStream>>();

/** Exercise React's real shell/segment streaming without opening any socket. */
function streamInMemory(content: ReactNode) {
    let html = '';
    const shell = deferred<void>();
    const loadingMarkup = deferred<void>();
    const complete = deferred<void>();
    const errors: unknown[] = [];
    const output = new Writable({
        write(chunk, _encoding, callback) {
            html += chunk.toString();
            if (/Loading your dashboard…(?:<!-- -->)?<\/p>/.test(html))
                loadingMarkup.resolve();
            callback();
        },
    });
    const document = createElement(
        'html',
        { lang: 'en' },
        createElement('head'),
        createElement('body', null, content),
    );
    const stream = renderToPipeableStream(document, {
        onShellReady() {
            stream.pipe(output);
            shell.resolve();
        },
        onShellError(error) {
            errors.push(error);
            output.end();
            shell.resolve();
            loadingMarkup.resolve();
        },
        onError(error) {
            errors.push(error);
        },
    });
    pendingStreams.add(stream);
    output.once('finish', () => {
        pendingStreams.delete(stream);
        complete.resolve();
    });
    return {
        shell: shell.promise,
        loadingMarkup: loadingMarkup.promise,
        complete: complete.promise,
        html: () => html,
        errors,
    };
}

const flushStreamingWork = () =>
    new Promise<void>(resolve => setImmediate(resolve));
const authorizedPrograms: Program[] = [
    { programId: 1, name: 'Authorized Uganda surveillance', country: 'Uganda' },
    { programId: 3, name: 'Authorized Ghana surveillance', country: 'Ghana' },
];
const donorSelection = { programs: authorizedPrograms, exclude: [3] };

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    for (const stream of pendingStreams) stream.abort();
    pendingStreams.clear();
});

describe('dashboard server streaming', () => {
    it.each(['view', 'programs'] as const)(
        'streams its public loading shell while %s resolves first',
        async first => {
            const view = deferred<null>();
            const programs = deferred<typeof donorSelection>();
            vi.mocked(getViewAs).mockReturnValue(view.promise);
            vi.mocked(getDashboardProgramSelection).mockReturnValue(
                programs.promise,
            );

            const page = DashboardPage();
            expect(isValidElement(page)).toBe(true);
            expect(getViewAs).not.toHaveBeenCalled();
            expect(getDashboardProgramSelection).not.toHaveBeenCalled();

            const rendered = streamInMemory(page);
            await rendered.shell;
            await rendered.loadingMarkup;

            expect(rendered.errors).toEqual([]);
            expect(rendered.html()).toContain('Loading your dashboard…');
            expect(rendered.html()).toContain('role="status"');
            expect(rendered.html()).toContain('VectorCam');
            expect(rendered.html()).toContain('data-slot="skeleton"');
            expect(rendered.html()).not.toContain('data-authorized-provider');
            expect(rendered.html()).not.toContain(authorizedPrograms[0].name);
            expect(DashboardProvider).not.toHaveBeenCalled();
            expect(AppHeader).not.toHaveBeenCalled();

            if (first === 'view') view.resolve(null);
            else programs.resolve(donorSelection);
            await flushStreamingWork();

            expect(rendered.html()).toContain('Loading your dashboard…');
            expect(rendered.html()).not.toContain('data-authorized-provider');
            expect(rendered.html()).not.toContain(authorizedPrograms[0].name);
            expect(DashboardProvider).not.toHaveBeenCalled();

            if (first === 'view') programs.resolve(donorSelection);
            else view.resolve(null);
            await rendered.complete;

            expect(rendered.errors).toEqual([]);
            expect(rendered.html()).toContain(
                'data-dashboard-view="stakeholder"',
            );
            expect(rendered.html()).toContain('data-default-exclusions="3"');
            expect(rendered.html()).toContain(authorizedPrograms[0].name);
            expect(rendered.html()).toContain(authorizedPrograms[1].name);
            expect(
                vi.mocked(DashboardProvider).mock.calls.at(-1)?.[0],
            ).toMatchObject({
                view: 'stakeholder',
                defaultExclude: [3],
                programs: authorizedPrograms,
            });
            expect(
                vi.mocked(AppHeader).mock.calls.at(-1)?.[0].viewAs,
            ).toBeNull();
        },
    );

    it('preserves the explicitly chosen internal view after authenticated resolution', async () => {
        vi.mocked(getViewAs).mockResolvedValue('developer');
        vi.mocked(getDashboardProgramSelection).mockResolvedValue({
            programs: authorizedPrograms,
            exclude: [5],
        });

        const rendered = streamInMemory(DashboardPage());
        await rendered.complete;

        expect(rendered.errors).toEqual([]);
        expect(rendered.html()).toContain('data-dashboard-view="developer"');
        expect(
            vi.mocked(DashboardProvider).mock.calls.at(-1)?.[0],
        ).toMatchObject({
            view: 'developer',
            defaultExclude: [5],
            programs: authorizedPrograms,
        });
        expect(vi.mocked(AppHeader).mock.calls.at(-1)?.[0].viewAs).toBe(
            'developer',
        );
    });

    it('streams the same visible layout fallback while viewer authorization is pending', async () => {
        const gate = deferred<void>();
        vi.mocked(ViewerGate).mockImplementation(async ({ children }) => {
            await gate.promise;
            return children;
        });
        const layout = DashboardLayout({
            children: createElement('p', null, 'Private dashboard content'),
        });
        expect(isValidElement(layout)).toBe(true);
        expect(ViewerGate).not.toHaveBeenCalled();

        const rendered = streamInMemory(layout);
        await rendered.shell;
        await rendered.loadingMarkup;

        expect(rendered.errors).toEqual([]);
        expect(rendered.html()).toContain('Loading your dashboard…');
        expect(rendered.html()).toContain('VectorCam');
        expect(rendered.html()).not.toContain('Private dashboard content');

        gate.resolve();
        await rendered.complete;

        expect(rendered.errors).toEqual([]);
        expect(rendered.html()).toContain('Private dashboard content');
        expect(getViewAs).not.toHaveBeenCalled();
        expect(getDashboardProgramSelection).not.toHaveBeenCalled();
    });
});
