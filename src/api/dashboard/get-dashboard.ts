import 'server-only';

import { loadProgramSnapshot } from '@/api/admin/load-program-snapshot';
import { loadPrograms } from '@/api/admin/load-programs';
import { loadCoverage } from '@/api/coverage/load-coverage';
import type {
    Dashboard,
    GetDashboardQuery,
} from '@/api/dashboard/validation/dashboard-schema';
import {
    buildPeriodMetrics,
    sessionsInPeriod,
    type ProgramData,
} from '@/features/dashboard/utils/build-period-metrics';
import { buildUserCoverage } from '@/features/dashboard/utils/build-coverage-metrics';
import { countActiveCollectors } from '@/features/dashboard/utils/count-active-collectors';
import { buildAreaMetrics } from '@/features/dashboard/utils/build-area-metrics';
import { buildSpecimenPoints } from '@/features/dashboard/utils/build-specimen-points';
import { classifyDevices } from '@/features/dashboard/utils/classify-devices';
import { maskSessionIds } from '@/features/dashboard/utils/mask-session-ids';
import { scopeSnapshot } from '@/features/dashboard/utils/counted-sessions';
import { programTimeZone } from '@/features/dashboard/utils/month-key';
import { siteLocationPath } from '@/features/dashboard/utils/site-location-path';
import { canSeeProgram, type Viewer } from '@/lib/auth-session/viewer';
import type { NetworkError } from '@/lib/network/network-error';
import { ok, type Result } from '@/lib/result/result';

export async function getDashboard(
    query: GetDashboardQuery,
    viewer: Viewer,
): Promise<Result<Dashboard, NetworkError>> {
    const [allPrograms, coverage] = await Promise.all([
        loadPrograms(),
        // Cached, and it answers in about a second: for the expected and
        // targeted user figures.
        loadCoverage(),
    ]);
    if (!allPrograms.ok) return allPrograms;

    // A Stakeholder's other Programs never leave the server.
    const visible = allPrograms.data.filter(program =>
        canSeeProgram(viewer, program.programId),
    );
    const excluded = new Set(query.exclude);
    const selected = visible.filter(
        program => !excluded.has(program.programId),
    );
    const snapshots = await Promise.all(
        selected.map(program => loadProgramSnapshot(program.programId)),
    );

    const loaded: ProgramData[] = [];
    const failedProgramIds: number[] = [];
    selected.forEach((program, index) => {
        const snapshot = snapshots[index];
        if (snapshot.ok)
            loaded.push({
                program,
                snapshot: scopeSnapshot(snapshot.data, query),
            });
        else failedProgramIds.push(program.programId);
    });

    const metrics = buildPeriodMetrics(loaded, query);
    const period = { from: metrics.from, to: metrics.to };
    const devices = loaded
        .flatMap(({ program, snapshot }) =>
            classifyDevices(
                snapshot.devices,
                snapshot.sessions,
                period,
                program.country,
                programTimeZone(snapshot.collectionCycles),
            ),
        )
        // Never-used devices are an internal list; they are never on the map.
        .filter(
            device =>
                viewer.role === 'developer' || device.status !== 'NEVER_USED',
        );
    // The summary table's rows; Stakeholders don't get the table.
    const areas =
        viewer.role === 'developer'
            ? loaded.flatMap(programData =>
                  buildAreaMetrics(programData, period),
              )
            : [];
    const specimenPoints: Dashboard['specimenPoints'] = {
        placed: [],
        unplaced: [],
    };
    for (const { program, snapshot } of loaded) {
        const points = buildSpecimenPoints(snapshot, program.country, period);
        specimenPoints.placed.push(...points.placed);
        specimenPoints.unplaced.push(...points.unplaced);
    }
    const sitePaths = Object.fromEntries(
        loaded.flatMap(({ snapshot }) =>
            snapshot.sites.map(site => [site.siteId, siteLocationPath(site)]),
        ),
    );
    const selectedIds = selected.map(program => program.programId);
    // Users are compared for the period's last month ("currently"), counting
    // collectors on the Sessions the Session filter keeps.
    const userCoverage = coverage.ok
        ? buildUserCoverage(
              coverage.data.figures,
              period.to,
              new Map(
                  loaded.map(({ program, snapshot }) => [
                      program.programId,
                      countActiveCollectors(
                          sessionsInPeriod(
                              snapshot.sessions,
                              { from: period.to, to: period.to },
                              programTimeZone(snapshot.collectionCycles),
                          ),
                      ),
                  ]),
              ),
          )
        : [];
    const fetchTimes = loaded.map(({ snapshot }) => snapshot.fetchedAt);

    return ok({
        viewer: viewer.role,
        programs: visible,
        selectedProgramIds: selectedIds,
        failedProgramIds,
        // Stakeholders get the period's totals for their headline tiles, but
        // no previous period, no per-Program breakdown and nothing about users
        // or logins.
        metrics:
            viewer.role === 'developer'
                ? metrics
                : {
                      ...period,
                      programs: [],
                      total: withoutUsers(metrics.total),
                      previousTotal: null,
                  },
        devices,
        areas,
        sitePaths,
        // Stakeholders see points and their specimens, never a Session's id.
        specimenPoints:
            viewer.role === 'developer'
                ? specimenPoints
                : maskSessionIds(specimenPoints),
        userCoverage,
        lastUpdatedAt: fetchTimes.length ? Math.min(...fetchTimes) : null,
    });
}

function withoutUsers<
    M extends { uniqueUsers: number | null; logins: number | null },
>(metrics: M | null): M | null {
    return metrics && { ...metrics, uniqueUsers: null, logins: null };
}
