import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import type {
    Dashboard,
    GetDashboardQuery,
} from '@/api/dashboard/validation/dashboard-schema';
import {
    buildPeriodMetrics,
    type ProgramData,
} from '@/features/dashboard/utils/build-period-metrics';
import { buildSpecimenPoints } from '@/features/dashboard/utils/build-specimen-points';
import { classifyDevices } from '@/features/dashboard/utils/classify-devices';
import { programTimeZone } from '@/features/dashboard/utils/month-key';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';

export async function getDashboard(
    query: GetDashboardQuery,
): Promise<Result<Dashboard, NetworkError>> {
    const programs = await loadPrograms();
    if (!programs.ok) return programs;

    const excluded = new Set(query.exclude);
    const selected = programs.data.filter(
        program => !excluded.has(program.programId),
    );
    const snapshots = await Promise.all(
        selected.map(program => loadProgramSnapshot(program.programId)),
    );

    const loaded: ProgramData[] = [];
    const failedProgramIds: number[] = [];
    selected.forEach((program, index) => {
        const snapshot = snapshots[index];
        if (snapshot.ok) loaded.push({ program, snapshot: snapshot.data });
        else failedProgramIds.push(program.programId);
    });

    const metrics = buildPeriodMetrics(loaded, query);
    const period = { from: metrics.from, to: metrics.to };
    const devices = loaded.flatMap(({ program, snapshot }) =>
        classifyDevices(
            snapshot.devices,
            snapshot.sessions,
            period,
            program.country,
            programTimeZone(snapshot.collectionCycles),
        ),
    );
    const specimenPoints: Dashboard['specimenPoints'] = {
        placed: [],
        unplaced: { sessions: 0, specimens: 0 },
    };
    for (const { program, snapshot } of loaded) {
        const points = buildSpecimenPoints(snapshot, program.country, period);
        specimenPoints.placed.push(...points.placed);
        specimenPoints.unplaced.sessions += points.unplaced.sessions;
        specimenPoints.unplaced.specimens += points.unplaced.specimens;
    }
    const fetchTimes = loaded.map(({ snapshot }) => snapshot.fetchedAt);

    return ok({
        programs: programs.data,
        selectedProgramIds: selected.map(program => program.programId),
        failedProgramIds,
        metrics,
        devices,
        specimenPoints,
        lastUpdatedAt: fetchTimes.length ? Math.min(...fetchTimes) : null,
    });
}
