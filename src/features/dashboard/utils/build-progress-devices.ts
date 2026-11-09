import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import type { Site } from '@/api/site/validation/site-schema';
import {
    prepareProgressData,
    type ProgressProgramData,
} from './build-progress';
import { collectorKeys } from './count-active-collectors';
import type { CoverageFigures } from './parse-coverage-sheets';
import type { ResolvedRange } from './resolve-reporting-range';
import { siteLocationPath } from './site-location-path';

/**
 * From here Uganda plans a phone per VHT, two per village (11 Districts × 3
 * villages × 2 = 66); before it, a village's VHTs shared one phone.
 */
const UGANDA_PHONE_PER_VHT_FROM = '2026-09';
const VHTS_PER_VILLAGE = 2;

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

type CountedSession = {
    siteId: number;
    deviceId?: number | null;
    collectorName?: string | null;
};

/**
 * Uganda's devices from villages and VHTs, not device ids (a reinstall makes
 * a new id): each village with data is one phone, or from September one per
 * VHT named, up to two. A village is the Site's path above the House.
 */
function countUgandaDevices(
    sessions: readonly CountedSession[],
    sites: ReadonlyMap<number, Site>,
    phonePerVht: boolean,
): number {
    const villages = new Map<string, Set<string>>();
    for (const session of sessions) {
        const site = sites.get(session.siteId);
        const key = (site ? siteLocationPath(site) : [])
            .filter(level => level.level !== 'House')
            .map(level => level.name.toLowerCase())
            .join(' > ');
        const people = villages.get(key) ?? new Set<string>();
        collectorKeys(session.collectorName ?? '').forEach(person =>
            people.add(person),
        );
        villages.set(key, people);
    }
    return [...villages.values()].reduce(
        (sum, people) =>
            sum +
            (phonePerVht
                ? Math.min(VHTS_PER_VILLAGE, Math.max(1, people.size))
                : 1),
        0,
    );
}

/**
 * Each Program's active devices in the period's last month, against the
 * workbook's plan for it. A Session counts in the month it was submitted, and
 * practice doesn't count. Uganda's plan Programs count villages and VHTs;
 * the rest count distinct devices. Never above the plan, which a reinstalled
 * phone's new id would otherwise push past. An estimate, not an inventory.
 */
export function buildProgressDevices(
    programs: ProgressProgramData[],
    range: ResolvedRange,
    plan: DevicePlan | null,
): ProgressProgramDevices[] {
    const { to, programs: prepared } = prepareProgressData(programs, range);
    return prepared.map(({ program, sites, sessions }) => {
        const { programId } = program;
        const planned = projectedFor(plan, programId, to);
        const counted = sessions.filter(
            session => session.month === to && session.type !== 'PRACTICE',
        );
        const villageRule =
            program.country.toLowerCase() === 'uganda' &&
            (plan?.units.some(
                row => row.programId === programId && row.status === 'Active',
            ) ??
                false);
        const active = villageRule
            ? countUgandaDevices(
                  counted,
                  sites,
                  to >= UGANDA_PHONE_PER_VHT_FROM,
              )
            : new Set(counted.flatMap(session => session.deviceId ?? [])).size;
        return {
            programId,
            active: planned === null ? 0 : Math.min(active, planned),
            planned,
        };
    });
}

/** Every Program with a plan, or just those behind the selected Area. */
export function devicesInSelection(
    devices: readonly ProgressProgramDevices[],
    selectedProgramIds: readonly number[] | null,
): ProgressProgramDevices[] {
    return devices.filter(
        program =>
            program.planned !== null &&
            (!selectedProgramIds ||
                selectedProgramIds.includes(program.programId)),
    );
}

/** The total active devices and plan; null when no Program has a plan. */
export function deviceFigures(devices: readonly ProgressProgramDevices[]): {
    active: number;
    planned: number | null;
} {
    const planned = devices.flatMap(program => program.planned ?? []);
    return {
        active: devices.reduce(
            (sum, program) =>
                sum + (program.planned === null ? 0 : program.active),
            0,
        ),
        planned:
            planned.length === 0 ? null : planned.reduce((a, b) => a + b, 0),
    };
}

/** Each Program Country's planned Programs added up, for the map's tags. */
export function deviceFiguresByCountry(
    devices: readonly ProgressProgramDevices[],
    programs: readonly Program[],
): Map<string, { active: number; planned: number }> {
    const countryOf = new Map(
        programs.map(program => [program.programId, program.country]),
    );
    const byCountry = Map.groupBy(
        devicesInSelection(devices, null),
        row => countryOf.get(row.programId) ?? '',
    );
    byCountry.delete('');
    return new Map(
        [...byCountry].map(([country, rows]) => {
            const { active, planned } = deviceFigures(rows);
            return [country, { active, planned: planned ?? 0 }];
        }),
    );
}
