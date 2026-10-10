import 'server-only';

import {
    loadProgressSnapshot,
    progressSnapshotTag,
} from '@/api/admin/load-progress-snapshot';
import { loadPrograms, PROGRAMS_TAG } from '@/api/admin/load-programs';
import { boundariesForCountry } from '@/api/coverage/boundaries';
import type { Program } from '@/api/program/validation/program-schema';
import type {
    GetProgressQuery,
    ProgressDashboard,
} from '@/api/progress/validation/progress-schema';
import {
    buildProgress,
    progressDistrictKey,
    type ProgressProgramData,
} from '@/features/dashboard/utils/build-progress';
import { coverageLabelPoint } from '@/features/dashboard/utils/coverage-label-point';
import {
    buildProgressDeviceMetrics,
    type ProgressDeviceMonth,
} from '@/features/dashboard/utils/build-progress-device-metrics';
import { canSeeProgram, type Viewer } from '@/lib/auth-session/viewer';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';
import {
    mergeLocationCoverage,
    progressLocationUnit,
    totalReportingLocations,
} from '@/features/dashboard/utils/progress-location-policy';

type ProgressRange = Pick<GetProgressQuery, 'from' | 'to'>;
type ProgressSummary = Omit<ProgressDashboard, 'programs'>;
const SCAN_COUNT_VERSION = 'image-count-v1-locations-v3-site-hierarchy-v1';

export async function getProgress(
    query: GetProgressQuery,
    viewer: Viewer,
): Promise<Result<ProgressDashboard, NetworkError>> {
    const scoped = await scopedPrograms(query, viewer);
    if (!scoped.ok) return scoped;
    // Authorization and the viewer's visible list stay outside shared cache.
    const summary = await loadProgressSummary(
        scoped.data.selected,
        { from: query.from, to: query.to },
        SCAN_COUNT_VERSION,
    );
    return ok({ ...summary, programs: scoped.data.visible });
}

/** The export computes actuals and internal figures from the same snapshot. */
export async function getProgressReportData(
    query: GetProgressQuery,
    viewer: Viewer,
): Promise<
    Result<
        {
            progress: ProgressDashboard;
            internalMetrics: ProgressDeviceMonth[];
        },
        NetworkError
    >
> {
    const scoped = await scopedPrograms(query, viewer);
    if (!scoped.ok) return scoped;
    const { summary, loaded } = await buildSelectedProgress(
        scoped.data.selected,
        query,
    );
    return ok({
        progress: { ...summary, programs: scoped.data.visible },
        internalMetrics: buildProgressDeviceMetrics(loaded, {
            from: summary.from,
            to: summary.to,
        }),
    });
}

async function scopedPrograms(query: GetProgressQuery, viewer: Viewer) {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const visible = programs.data.filter(program =>
        canSeeProgram(viewer, program.programId),
    );
    const selected = visible
        .filter(program => !query.exclude.includes(program.programId))
        .sort((a, b) => a.programId - b.programId);
    return ok({ visible, selected });
}

/** Cache the small donor DTO instead of restoring raw records for every visit. */
async function loadProgressSummary(
    selected: Program[],
    range: ProgressRange,
    scanCountVersion: string,
): Promise<ProgressSummary> {
    'use cache';
    cacheTag(
        PROGRAMS_TAG,
        ...selected.map(program => progressSnapshotTag(program.programId)),
        `progress-summary-${scanCountVersion}`,
    );
    const { summary } = await buildSelectedProgress(selected, range);
    if (
        summary.failedProgramIds.length > 0 ||
        summary.uniqueScans === null ||
        summary.coverageByProgram.some(group => group.count === null)
    )
        cacheLife('seconds');
    else cacheLife('hours');
    return summary;
}

/** Shared loading and aggregation keep dashboard and export definitions equal. */
async function buildSelectedProgress(
    selected: Program[],
    range: ProgressRange,
) {
    const snapshots = await Promise.all(
        selected.map(program => loadProgressSnapshot(program.programId)),
    );
    const loaded: ProgressProgramData[] = [];
    const failedProgramIds: number[] = [];
    selected.forEach((program, index) => {
        const snapshot = snapshots[index];
        if (snapshot.ok) loaded.push({ program, snapshot: snapshot.data });
        else failedProgramIds.push(program.programId);
    });

    // These are committed district geometries, independent of the rollout
    // workbook. Only districts with actual reporting sessions become nodes.
    const anchors = new Map<string, { latitude: number; longitude: number }>();
    for (const { program } of loaded) {
        for (const boundary of boundariesForCountry(program.country)) {
            const point = coverageLabelPoint(boundary.geometry);
            if (point)
                anchors.set(
                    progressDistrictKey(
                        program.country,
                        boundary.name,
                        program.programId,
                    ),
                    { latitude: point.at[0], longitude: point.at[1] },
                );
        }
    }

    const aggregate = buildProgress(loaded, range, anchors);
    const coverageByProgram = mergeLocationCoverage([
        ...aggregate.coverageByProgram,
        ...selected
            .filter(program => failedProgramIds.includes(program.programId))
            .map(program => ({
                programId: program.programId,
                unit: progressLocationUnit(program),
                count: null,
            })),
    ]);
    const summary: ProgressSummary = {
        selectedProgramIds: selected.map(program => program.programId),
        failedProgramIds,
        ...aggregate,
        coverageByProgram,
        scansByProgram: [
            ...aggregate.scansByProgram,
            ...failedProgramIds.map(programId => ({ programId, scans: null })),
        ].sort((a, b) => a.programId - b.programId),
        reportingLocations: totalReportingLocations(coverageByProgram),
    };
    return { summary, loaded };
}
