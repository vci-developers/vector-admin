import type { CoverageFigures } from '@/features/dashboard/utils/parse-coverage-sheets';
import { err, ok } from '@/lib/result/result';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCoverage } from './load-coverage';
import {
    readLastGoodWorkbook,
    storeLastGoodWorkbook,
} from './last-good-workbook';
import { readCoverageWorkbook } from './read-coverage-workbook';

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('./last-good-workbook', () => ({
    readLastGoodWorkbook: vi.fn(),
    storeLastGoodWorkbook: vi.fn(),
}));
vi.mock('./read-coverage-workbook', () => ({ readCoverageWorkbook: vi.fn() }));

const file = Uint8Array.from([1, 2, 3]).buffer;
const figures: CoverageFigures = {
    units: [
        {
            programId: 7,
            unit: 'Gulu',
            status: 'Active',
            boundary: null,
            region: null,
        },
    ],
    expectedUsers: [],
    programPotential: [],
    projectedDevices: [],
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('COVERAGE_WORKBOOK_URL', 'https://planning.test/workbook');
    // Every possible network entry point is mocked. These tests never contact
    // SharePoint or Blob storage and never require a real credential.
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(file)),
    );
    vi.mocked(readCoverageWorkbook).mockResolvedValue(ok(figures));
    vi.mocked(readLastGoodWorkbook).mockResolvedValue(err('No saved workbook'));
    vi.mocked(storeLastGoodWorkbook).mockResolvedValue(undefined);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('loadCoverage read-only planning', () => {
    it('returns validated live plans without calling storage when readOnly is true', async () => {
        const result = await loadCoverage(true);

        expect(result).toEqual(
            ok({ figures, source: 'live', savedAt: null, liveProblem: null }),
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://planning.test/workbook?download=1',
            expect.objectContaining({ redirect: 'manual' }),
        );
        expect(storeLastGoodWorkbook).not.toHaveBeenCalled();
        expect(readLastGoodWorkbook).not.toHaveBeenCalled();
    });

    it('preserves fallback persistence for the existing default loader path', async () => {
        const result = await loadCoverage();

        expect(result.ok).toBe(true);
        expect(storeLastGoodWorkbook).toHaveBeenCalledExactlyOnceWith(file);
    });

    it('reads an existing saved plan without writing when live plans are unavailable', async () => {
        vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
        vi.mocked(readLastGoodWorkbook).mockResolvedValue(
            ok({ file, savedAt: 1234 }),
        );

        const result = await loadCoverage(true);

        expect(result).toEqual(
            ok({
                figures,
                source: 'saved',
                savedAt: 1234,
                liveProblem: 'SharePoint answered 503',
            }),
        );
        expect(storeLastGoodWorkbook).not.toHaveBeenCalled();
    });
});
