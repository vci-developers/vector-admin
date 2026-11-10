import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramDevices } from '@/api/progress/validation/progress-schema';
import type { CoverageFigures } from './parse-coverage-sheets';

type DeviceSheet = Pick<CoverageFigures, 'projectedDevices'>;

/**
 * Each Program's devices from the workbook's Projected Devices tab, whose
 * month columns hold the active count and whose last column is the target:
 * the count in `month` (null where the cell is blank) and the target.
 */
export function buildProgressDevices(
    programIds: readonly number[],
    month: string,
    sheet: DeviceSheet | null,
): ProgressProgramDevices[] {
    return programIds.map(programId => {
        const rows = (sheet?.projectedDevices ?? [])
            .filter(row => row.programId === programId)
            .toSorted((a, b) => a.month.localeCompare(b.month));
        return {
            programId,
            active: rows.find(row => row.month === month)?.projected ?? null,
            target: rows.at(-1)?.projected ?? null,
            targetMonth: rows.at(-1)?.month ?? null,
        };
    });
}

/**
 * The target shows only for a period that runs up to now (Year to date, All
 * time…): a single month, or one that ends earlier, shows the count alone.
 */
export function showsDeviceTarget(
    range: { from?: string; to: string },
    lastCompleteMonth: string,
): boolean {
    return range.from !== range.to && range.to >= lastCompleteMonth;
}

/** Programs with a count or, when shown, a target. */
function hasDevices(row: ProgressProgramDevices, withTarget: boolean) {
    return row.active !== null || (withTarget && row.target !== null);
}

/** Every Program, or just those behind the selected Area. */
export function devicesInSelection(
    devices: readonly ProgressProgramDevices[],
    selectedProgramIds: readonly number[] | null,
): ProgressProgramDevices[] {
    return devices.filter(
        program =>
            !selectedProgramIds ||
            selectedProgramIds.includes(program.programId),
    );
}

export type DeviceFigures = {
    active: number;
    target: number | null;
    /** The latest of the targets' months. */
    targetMonth: string | null;
};

/** The total count, and target when shown; null without either. */
export function deviceFigures(
    devices: readonly ProgressProgramDevices[],
    withTarget: boolean,
): DeviceFigures | null {
    const counted = devices.filter(row => hasDevices(row, withTarget));
    if (counted.length === 0) return null;
    const targets = counted.flatMap(row => row.target ?? []);
    const months = counted.flatMap(row => row.targetMonth ?? []).toSorted();
    const withTargets = withTarget && targets.length > 0;
    return {
        active: counted.reduce((sum, row) => sum + (row.active ?? 0), 0),
        target: withTargets ? targets.reduce((a, b) => a + b, 0) : null,
        targetMonth: withTargets ? (months.at(-1) ?? null) : null,
    };
}

/** Each Program Country's active devices, for the map's tags. */
export function activeDevicesByCountry(
    devices: readonly ProgressProgramDevices[],
    programs: readonly Program[],
): Map<string, number> {
    const countryOf = new Map(
        programs.map(program => [program.programId, program.country]),
    );
    const byCountry = new Map<string, number>();
    for (const row of devices) {
        const country = countryOf.get(row.programId);
        if (country === undefined || row.active === null) continue;
        byCountry.set(country, (byCountry.get(country) ?? 0) + row.active);
    }
    return byCountry;
}
