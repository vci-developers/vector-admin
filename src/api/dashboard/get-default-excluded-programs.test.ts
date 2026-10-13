import { loadPrograms } from '@/api/admin/load-programs';
import type { Program } from '@/api/program/validation/program-schema';
import type { Viewer } from '@/lib/auth-session/viewer';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getDashboardProgramSelection,
    getDefaultExcludedPrograms,
} from './get-default-excluded-programs';

vi.mock('@/api/admin/load-programs', () => ({ loadPrograms: vi.fn() }));
vi.mock('@/lib/auth-session/with-viewer', () => ({ withViewer: vi.fn() }));

const programs: Program[] = [
    { programId: 7, name: 'Uganda surveillance', country: 'Uganda' },
    { programId: 8, name: 'Kenya surveillance', country: 'Kenya' },
    { programId: 9, name: 'Ghana surveillance', country: 'Ghana' },
];
let viewer: Viewer;

beforeEach(() => {
    vi.clearAllMocks();
    viewer = { role: 'stakeholder', programIds: [7, 9] };
    vi.mocked(withViewer).mockImplementation(async callback =>
        callback(viewer),
    );
    vi.mocked(loadPrograms).mockResolvedValue(ok(programs));
});

describe('getDashboardProgramSelection', () => {
    it('only exposes authorized program metadata', async () => {
        const selection = await getDashboardProgramSelection();

        expect(selection).toEqual({
            programs: [programs[0], programs[2]],
            exclude: [],
        });
        expect(loadPrograms).toHaveBeenCalledTimes(1);
        expect(
            selection.programs.map(program => program.programId),
        ).not.toContain(8);
        expect(selection.exclude).not.toContain(8);
    });

    it('opens a Stakeholder on every authorized program', async () => {
        viewer = { role: 'stakeholder', programIds: null };

        expect(await getDashboardProgramSelection()).toEqual({
            programs,
            exclude: [],
        });
    });

    it('preserves the internal developer default', async () => {
        viewer = { role: 'developer' };

        expect(await getDashboardProgramSelection()).toEqual({
            programs,
            exclude: [5],
        });
    });

    it('returns no metadata when the program lookup fails', async () => {
        vi.mocked(loadPrograms).mockResolvedValue(err({ kind: 'network' }));

        expect(await getDashboardProgramSelection()).toEqual({
            programs: [],
            exclude: [5],
        });
    });

    it('does not look up or expose metadata when viewer authorization fails', async () => {
        vi.mocked(withViewer).mockResolvedValue(
            err({ kind: 'forbidden', status: 403 }),
        );

        expect(await getDashboardProgramSelection()).toEqual({
            programs: [],
            exclude: [5],
        });
        expect(loadPrograms).not.toHaveBeenCalled();
    });
});

describe('getDefaultExcludedPrograms', () => {
    it.each<Viewer>([
        { role: 'stakeholder', programIds: [7, 9] },
        { role: 'stakeholder', programIds: [8] },
        { role: 'stakeholder', programIds: null },
        { role: 'developer' },
    ])('matches the metadata selection for %j', async authorizedViewer => {
        viewer = authorizedViewer;
        const selection = await getDashboardProgramSelection();

        expect(await getDefaultExcludedPrograms()).toEqual(selection.exclude);
    });

    it('preserves fallback exclusions when metadata is unavailable', async () => {
        vi.mocked(loadPrograms).mockResolvedValue(err({ kind: 'network' }));

        expect(await getDefaultExcludedPrograms()).toEqual([5]);
    });
});
