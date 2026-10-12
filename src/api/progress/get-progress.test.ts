import { loadProgressSnapshot } from '@/api/admin/load-progress-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import { err, ok } from '@/lib/result/result';
import * as deviceMetrics from '@/features/dashboard/utils/build-progress-device-metrics';
import { cacheLife, cacheTag } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgress, getProgressReportData } from './get-progress';
import {
    getProgressQuerySchema,
    progressDashboardSchema,
    type GetProgressQuery,
} from './validation/progress-schema';

vi.mock('@/api/admin/load-programs', () => ({
    loadPrograms: vi.fn(),
    PROGRAMS_TAG: 'programs',
}));
vi.mock('@/api/admin/load-progress-snapshot', () => ({
    loadProgressSnapshot: vi.fn(),
    progressSnapshotTag: (programId: number) => `program-progress-${programId}`,
}));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const programs = [
    { programId: 7, name: 'Uganda reporting', country: 'Uganda' },
    { programId: 8, name: 'Kenya reporting', country: 'Kenya' },
];
const query: GetProgressQuery = {
    exclude: [],
    from: '2026-02',
    to: '2026-02',
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadPrograms).mockResolvedValue(ok(programs));
    vi.mocked(loadProgressSnapshot).mockImplementation(async programId =>
        ok({
            programId,
            sessions: [],
            specimens: [],
            sites: [],
            collectionCycles: [],
            fetchedAt: 100,
        }),
    );
});

afterEach(() => vi.restoreAllMocks());

describe('getProgress', () => {
    it('does not fetch or expose programs outside a stakeholder grant', async () => {
        const result = await getProgress(query, {
            role: 'stakeholder',
            programIds: [7],
        });
        expect(loadProgressSnapshot).toHaveBeenCalledTimes(1);
        expect(loadProgressSnapshot).toHaveBeenCalledWith(7);
        expect(result.ok && result.data.programs).toEqual([programs[0]]);
        expect(result.ok && result.data.selectedProgramIds).toEqual([7]);
        expect(result.ok && result.data.scansByProgram).toEqual([
            { programId: 7, scans: 0, specimens: 0 },
        ]);
        expect(result.ok && result.data.coverageByProgram).toEqual([
            { programId: 7, unit: 'collection-site', count: 0 },
        ]);
        expect(cacheTag).toHaveBeenCalledWith(
            'programs',
            'program-progress-7',
            'progress-summary-image-count-v1-locations-v3-site-hierarchy-v1-all-types-v1',
        );
        expect(cacheLife).toHaveBeenCalledWith('hours');
        expect(
            result.ok && progressDashboardSchema.safeParse(result.data).success,
        ).toBe(true);
    });

    it('marks failed programs while retaining real successful totals', async () => {
        vi.mocked(loadProgressSnapshot).mockResolvedValueOnce(
            err({ kind: 'network' }),
        );
        const result = await getProgress(query, { role: 'developer' });
        expect(result.ok && result.data).toMatchObject({
            selectedProgramIds: [7, 8],
            failedProgramIds: [7],
            reportingLocations: null,
            coverageByProgram: [
                { programId: 7, unit: 'collection-site', count: null },
                { programId: 8, unit: 'collection-site', count: 0 },
            ],
            uniqueScans: 0,
            scansByProgram: [
                { programId: 7, scans: null },
                { programId: 8, scans: 0 },
            ],
        });
        expect(cacheLife).toHaveBeenCalledWith('seconds');
    });

    it('uses null counts when every selected program failed or no program was selected', async () => {
        vi.mocked(loadProgressSnapshot).mockResolvedValue(
            err({ kind: 'network' }),
        );
        const failed = await getProgress(query, { role: 'developer' });
        expect(failed.ok && failed.data).toMatchObject({
            failedProgramIds: [7, 8],
            reportingLocations: null,
            uniqueScans: null,
            scansByProgram: [
                { programId: 7, scans: null },
                { programId: 8, scans: null },
            ],
            coverageByProgram: [
                { programId: 7, unit: 'collection-site', count: null },
                { programId: 8, unit: 'collection-site', count: null },
            ],
        });
        const empty = await getProgress(
            { ...query, exclude: [7, 8] },
            { role: 'developer' },
        );
        expect(empty.ok && empty.data).toMatchObject({
            selectedProgramIds: [],
            failedProgramIds: [],
            reportingLocations: null,
            uniqueScans: null,
            scansByProgram: [],
            coverageByProgram: [],
        });
        expect(cacheLife).toHaveBeenCalledTimes(2);
        expect(cacheLife).toHaveBeenNthCalledWith(1, 'seconds');
        expect(cacheLife).toHaveBeenNthCalledWith(2, 'seconds');
    });

    it('retains reviewed program units for failed snapshots rather than fabricating a zero', async () => {
        vi.mocked(loadPrograms).mockResolvedValue(
            ok([
                { programId: 1, name: 'Uganda', country: 'Uganda' },
                { programId: 2, name: 'Colombia', country: 'Colombia' },
                { programId: 3, name: 'Ghana', country: 'Ghana' },
            ]),
        );
        vi.mocked(loadProgressSnapshot).mockImplementation(async programId =>
            programId === 3
                ? err({ kind: 'network' })
                : ok({
                      programId,
                      sessions: [],
                      specimens: [],
                      sites: [],
                      collectionCycles: [],
                      fetchedAt: 100,
                  }),
        );
        const result = await getProgress(query, { role: 'developer' });
        expect(result.ok && result.data).toMatchObject({
            failedProgramIds: [3],
            coverageByProgram: [
                { programId: 1, unit: 'household', count: 0 },
                { programId: 2, unit: 'municipality', count: 0 },
                { programId: 3, unit: 'household', count: null },
            ],
            reportingLocations: null,
            uniqueScans: 0,
        });
    });

    it('caches incomplete location metadata briefly while retaining valid scan totals', async () => {
        vi.mocked(loadPrograms).mockResolvedValue(
            ok([{ programId: 1, name: 'Uganda', country: 'Uganda' }]),
        );
        vi.mocked(loadProgressSnapshot).mockResolvedValue(
            ok({
                programId: 1,
                sessions: [
                    {
                        sessionId: 1,
                        siteId: 1,
                        type: 'SURVEILLANCE',
                        collectionDate: Date.UTC(2026, 1, 5),
                        submittedAt: Date.UTC(2026, 1, 6),
                        latitude: null,
                        longitude: null,
                    },
                ],
                specimens: [
                    { id: 1, sessionId: 1, images: [{ id: 10 }, { id: 11 }] },
                ],
                sites: [
                    {
                        siteId: 1,
                        name: null,
                        district: 'Gulu',
                        villageName: 'Aleu',
                        houseNumber: 'N/A',
                        locationHierarchy: {},
                    },
                ],
                collectionCycles: [],
                fetchedAt: 100,
            }),
        );
        const result = await getProgress(query, { role: 'developer' });
        expect(result.ok && result.data).toMatchObject({
            failedProgramIds: [],
            coverageByProgram: [
                { programId: 1, unit: 'household', count: null },
            ],
            reportingLocations: null,
            uniqueScans: 2,
        });
        expect(cacheLife).toHaveBeenCalledWith('seconds');
    });

    it('ignores session-type and test-site parameters', () => {
        expect(
            getProgressQuerySchema.parse({
                to: '2026-02',
                types: 'PRACTICE',
                testSites: 'true',
            }),
        ).toEqual({ exclude: [], to: '2026-02' });
        expect(
            getProgressQuerySchema.safeParse({ from: '2026-03', to: '2026-02' })
                .success,
        ).toBe(false);
    });

    it('keeps operating metrics in the export service and out of the dashboard DTO', async () => {
        const report = await getProgressReportData(query, {
            role: 'stakeholder',
            programIds: [7],
        });
        expect(report.ok && report.data.internalMetrics).toHaveLength(1);
        const progress = await getProgress(query, {
            role: 'stakeholder',
            programIds: [7],
        });
        expect(progress.ok && progress.data).not.toHaveProperty(
            'internalMetrics',
        );
        expect(progress.ok && progress.data).not.toHaveProperty('deviceId');
    });

    it('does not calculate export-only device metrics for the donor dashboard', async () => {
        const operatingMetrics = vi.spyOn(
            deviceMetrics,
            'buildProgressDeviceMetrics',
        );
        const result = await getProgress(query, {
            role: 'stakeholder',
            programIds: [7],
        });
        expect(result.ok).toBe(true);
        expect(operatingMetrics).not.toHaveBeenCalled();
    });

    it('keeps donor and export aggregates equal with identical authorized snapshots', async () => {
        const operatingMetrics = vi.spyOn(
            deviceMetrics,
            'buildProgressDeviceMetrics',
        );
        vi.mocked(loadProgressSnapshot).mockImplementation(async programId =>
            ok({
                programId,
                sessions: [
                    {
                        sessionId: 1,
                        siteId: 1,
                        deviceId: 20,
                        type: 'SURVEILLANCE',
                        collectionDate: Date.UTC(2026, 1, 5),
                        submittedAt: Date.UTC(2026, 1, 6),
                        latitude: null,
                        longitude: null,
                    },
                ],
                specimens: [
                    { id: 1, sessionId: 1, images: [{ id: 10 }, { id: 11 }] },
                ],
                sites: [
                    {
                        siteId: 1,
                        name: null,
                        district: 'Gulu',
                        locationHierarchy: {},
                    },
                ],
                collectionCycles: [],
                fetchedAt: 100,
            }),
        );
        const viewer = { role: 'stakeholder' as const, programIds: [7] };
        const donor = await getProgress(query, viewer);
        const report = await getProgressReportData(query, viewer);
        expect(donor.ok && report.ok && donor.data).toEqual(
            report.ok && report.data.progress,
        );
        expect(donor.ok && donor.data.uniqueScans).toBe(2);
        expect(donor.ok && donor.data.scansByProgram).toEqual([
            { programId: 7, scans: 2, specimens: 1 },
        ]);
        expect(operatingMetrics).toHaveBeenCalledTimes(1);
        expect(report.ok && report.data.internalMetrics[0]).toMatchObject({
            reportingDevices: 1,
            uniqueScans: 2,
            scansPerReportingDevice: 2,
        });
        expect(loadProgressSnapshot).toHaveBeenCalledTimes(2);
        expect(
            vi
                .mocked(loadProgressSnapshot)
                .mock.calls.every(([id]) => id === 7),
        ).toBe(true);
    });
});
