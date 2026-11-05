import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import {
    prepareProgressData,
    progressDistrictName,
    UNKNOWN_DISTRICT,
    type ProgressProgramData,
} from './build-progress';
import { countSentinelSites } from './count-sentinel-sites';
import {
    countVillageDevices,
    plannedVillageDevices,
} from './count-village-devices';
import {
    normalizePlaceName,
    type CoverageFigures,
} from './parse-coverage-sheets';
import { progressLocationUnit } from './progress-location-policy';
import type { ResolvedRange } from './resolve-reporting-range';
import { siteLocationPath } from './site-location-path';

/** Uganda's rollout rule starts here; earlier months follow the workbook. */
const UGANDA_RULE_FROM = '2026-09';

type DevicePlan = Pick<CoverageFigures, 'units' | 'projectedDevices'>;

/** The month's Projected Devices, or the latest before it: rows can skip months. */
function projectedFor(
    plan: DevicePlan | null,
    programId: number,
    month: string,
): number | null {
    const latest = plan?.projectedDevices
        .filter(row => row.programId === programId && row.month <= month)
        .toSorted((a, b) => b.month.localeCompare(a.month))[0];
    return latest?.projected ?? null;
}

const sumActive = (areas: readonly { active: number }[]) =>
    areas.reduce((sum, area) => sum + area.active, 0);

/**
 * Trims Areas, smallest last, until they add up to the plan, so a Program's
 * lines always reconcile with its total.
 */
function fitAreasToPlan<Area extends { active: number }>(
    areas: Area[],
    planned: number | null,
): Area[] {
    if (planned === null || sumActive(areas) <= planned) return areas;
    let left = planned;
    return areas
        .toSorted((a, b) => b.active - a.active)
        .map(area => {
            const active = Math.min(area.active, left);
            left -= active;
            return { ...area, active };
        });
}

/**
 * Each Program's plan for the period's last month, and which devices count as
 * active: the plan is the workbook's, and real data only says where collection
 * happened. Uganda follows the team's village and VHT rule. The workbook has
 * no devices per place elsewhere, so a Sentinel Site with data is one device.
 */
export function buildProgressDevices(
    programs: ProgressProgramData[],
    range: ResolvedRange,
    plan: DevicePlan | null,
): ProgressProgramDevices[] {
    const { to, programs: prepared } = prepareProgressData(programs, range);
    return prepared.map(({ program, snapshot, sites, sessions }) => {
        const { programId } = program;
        const unit = progressLocationUnit(program, snapshot.sites);
        // The map's own Area names, so a selected Area finds its devices.
        const areaOf = (siteId: number) =>
            progressDistrictName(sites.get(siteId), unit) ?? UNKNOWN_DISTRICT;
        const sitePaths = Object.fromEntries(
            snapshot.sites.map(site => {
                const [top, ...rest] = siteLocationPath(site);
                return [
                    site.siteId,
                    top ? [{ ...top, name: areaOf(site.siteId) }, ...rest] : [],
                ];
            }),
        );
        const projected = projectedFor(plan, programId, to);

        if (program.country.toLowerCase() === 'uganda') {
            const counts = countVillageDevices(
                sessions.map(session => ({
                    siteId: session.siteId,
                    collectorName: session.collectorName ?? '',
                })),
                sitePaths,
            );
            const activeUnits =
                plan?.units.filter(
                    row =>
                        row.programId === programId && row.status === 'Active',
                ) ?? [];
            if (to < UGANDA_RULE_FROM || activeUnits.length === 0) {
                const areas = fitAreasToPlan(
                    counts.map(({ area, count }) => ({
                        name: area,
                        active: count,
                        planned: null,
                    })),
                    projected,
                );
                return {
                    programId,
                    active: sumActive(areas),
                    planned: projected,
                    areas,
                };
            }
            // Only the plan's Districts: others have no devices to count.
            const plannedByArea = new Map(
                activeUnits.map(row => [
                    normalizePlaceName(row.unit),
                    plannedVillageDevices(row.unit),
                ]),
            );
            const areas = counts.flatMap(({ area, count }) => {
                const planned = plannedByArea.get(normalizePlaceName(area));
                return planned === undefined
                    ? []
                    : [
                          {
                              name: area,
                              active: Math.min(count, planned),
                              planned,
                          },
                      ];
            });
            return {
                programId,
                active: sumActive(areas),
                planned: [...plannedByArea.values()].reduce((a, b) => a + b, 0),
                areas,
            };
        }

        const visits = sessions.map(({ siteId }) => ({
            siteId,
            location: sitePaths[siteId] ?? [],
        }));
        const areas = fitAreasToPlan(
            [...Map.groupBy(visits, visit => areaOf(visit.siteId))].map(
                ([name, list]) => ({
                    name,
                    active: countSentinelSites(list).sentinelSites,
                    planned: null,
                }),
            ),
            projected,
        );
        return {
            programId,
            active: sumActive(areas),
            planned: projected,
            areas,
        };
    });
}

export type DeviceSelection = {
    name: string;
    programIds: readonly number[];
};

/** Every Program's Areas, alphabetically, or just the selected Area's. */
export function devicesInSelection(
    devices: readonly ProgressProgramDevices[],
    selected: DeviceSelection | null,
): ProgressProgramDevices[] {
    const sorted = devices.map(program => ({
        ...program,
        areas: program.areas.toSorted((a, b) => a.name.localeCompare(b.name)),
    }));
    if (!selected) return sorted;
    const name = normalizePlaceName(selected.name);
    return sorted.flatMap(program => {
        const area = program.areas.find(
            row => normalizePlaceName(row.name) === name,
        );
        return area && selected.programIds.includes(program.programId)
            ? [
                  {
                      ...program,
                      active: area.active,
                      planned: area.planned,
                      areas: [area],
                  },
              ]
            : [];
    });
}

/** A Program's Areas worth listing: one alone only repeats its total. */
export function namedAreas(program: ProgressProgramDevices) {
    const named = program.areas.filter(area => area.name !== UNKNOWN_DISTRICT);
    return named.length > 1 ? named : [];
}

/** The total active devices, and the plans that exist; null if none do. */
export function deviceFigures(devices: readonly ProgressProgramDevices[]): {
    active: number;
    planned: number | null;
} {
    const planned = devices.flatMap(program => program.planned ?? []);
    return {
        active: sumActive(devices),
        planned:
            planned.length === 0 ? null : planned.reduce((a, b) => a + b, 0),
    };
}
