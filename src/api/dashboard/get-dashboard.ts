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
import {
    areaShare,
    capAreaDevices,
} from '@/features/dashboard/utils/cap-area-devices';
import { classifyDevices } from '@/features/dashboard/utils/classify-devices';
import {
    countVillageDevices,
    plannedVillageDevices,
    UGANDA_SENTINEL_SITES_PER_DISTRICT,
} from '@/features/dashboard/utils/count-village-devices';
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
    // For the expected and targeted user figures; started now but awaited
    // only after the Sessions, which never wait on SharePoint.
    const coverageLoad = loadCoverage();
    const allPrograms = await loadPrograms();
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
    const coverage = await coverageLoad;

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
    // A Stakeholder's map never shows an Area more devices than the month's
    // plan gives it: phones re-registering under new ids would inflate it.
    const areaOf = (siteId: number | null) =>
        (siteId === null ? undefined : sitePaths[siteId]?.[0]?.name) ?? '';
    // The period's last month's planned devices, for the cap and the panel.
    const projectedDevices = coverage.ok
        ? coverage.data.figures.projectedDevices.filter(
              row =>
                  row.month === period.to &&
                  loaded.some(
                      ({ program }) => program.programId === row.programId,
                  ),
          )
        : [];
    // Each Program's Areas in the plan: its Active units on the workbook's
    // Geographic Units sheet (Uganda: 11 Districts), the same whoever has
    // reported so far.
    const plannedAreas = loaded.map(({ program }) => ({
        programId: program.programId,
        areas: coverage.ok
            ? coverage.data.figures.units.filter(
                  unit =>
                      unit.programId === program.programId &&
                      unit.status === 'Active',
              ).length
            : 0,
        sentinelSites:
            program.country.toLowerCase() === 'uganda'
                ? UGANDA_SENTINEL_SITES_PER_DISTRICT
                : null,
    }));
    // Uganda's planned devices per Active District by the team's rule, which
    // the map and panel read against instead of the workbook's figure.
    const areaDevicePlans = coverage.ok
        ? loaded
              .filter(
                  ({ program }) => program.country.toLowerCase() === 'uganda',
              )
              .flatMap(({ program }) =>
                  coverage.data.figures.units
                      .filter(
                          unit =>
                              unit.programId === program.programId &&
                              unit.status === 'Active',
                      )
                      .map(unit => ({
                          programId: program.programId,
                          area: unit.unit,
                          planned: plannedVillageDevices(unit.unit),
                      })),
              )
        : [];
    const deviceCaps = new Map(
        plannedAreas.map(({ programId, areas }) => [
            programId,
            areaShare(
                projectedDevices.find(row => row.programId === programId)
                    ?.projected,
                areas,
            ),
        ]),
    );
    const shownDevices =
        viewer.role === 'developer'
            ? devices
            : capAreaDevices(
                  devices,
                  device => areaOf(device.siteId),
                  programId => deviceCaps.get(programId) ?? null,
              );
    // What a Stakeholder's badges and panel count as active devices per Area
    // over the period: Uganda's from villages and people, others' the capped
    // devices.
    const deviceCounts =
        viewer.role === 'developer'
            ? null
            : loaded.flatMap(({ program, snapshot }) => {
                  const counts =
                      program.country.toLowerCase() === 'uganda'
                          ? countVillageDevices(
                                sessionsInPeriod(
                                    snapshot.sessions,
                                    period,
                                    programTimeZone(snapshot.collectionCycles),
                                ),
                                sitePaths,
                            )
                          : [
                                ...Map.groupBy(
                                    shownDevices.filter(
                                        device =>
                                            device.programId ===
                                                program.programId &&
                                            device.status === 'ACTIVE',
                                    ),
                                    device => areaOf(device.siteId),
                                ),
                            ].map(([area, list]) => ({
                                area,
                                count: list.length,
                            }));
                  return counts.map(row => ({
                      programId: program.programId,
                      ...row,
                  }));
              });
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
        // Stakeholders get the period's totals and each Program's figures for
        // their headline tiles, but no previous period, no cycles and nothing
        // about users or logins.
        metrics:
            viewer.role === 'developer'
                ? metrics
                : {
                      ...period,
                      programs: metrics.programs.map(row => ({
                          programId: row.programId,
                          metrics: {
                              ...row.metrics,
                              uniqueUsers: null,
                              logins: null,
                          },
                          cycles: [],
                      })),
                      total: withoutUsers(metrics.total),
                      previousTotal: null,
                  },
        devices: shownDevices,
        areas,
        sitePaths,
        // Stakeholders see points and their specimens, never a Session's id.
        specimenPoints:
            viewer.role === 'developer'
                ? specimenPoints
                : maskSessionIds(specimenPoints),
        userCoverage,
        projectedDevices: projectedDevices.map(({ programId, projected }) => ({
            programId,
            projected,
        })),
        plannedAreas,
        deviceCounts,
        areaDevicePlans,
        lastUpdatedAt: fetchTimes.length ? Math.min(...fetchTimes) : null,
    });
}

function withoutUsers<
    M extends { uniqueUsers: number | null; logins: number | null },
>(metrics: M | null): M | null {
    return metrics && { ...metrics, uniqueUsers: null, logins: null };
}
