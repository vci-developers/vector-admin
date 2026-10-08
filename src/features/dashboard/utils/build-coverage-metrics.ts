import type { MonthKey } from './month-key';
import type { CoverageFigures } from './parse-coverage-sheets';

export type CoverageRatio = {
    numerator: number;
    denominator: number;
    /** null when the denominator is 0. */
    value: number | null;
};

/** One Program's place metrics; null where the workbook lists no units. */
export type ProgramCoverage = {
    programId: number;
    geographicCoverage: CoverageRatio | null;
    penetration: CoverageRatio | null;
};

/** One Program's user metrics for one month; null where a figure is missing. */
export type ProgramUserCoverage = {
    programId: number;
    month: MonthKey;
    instantaneousUserCoverage: CoverageRatio | null;
    programUserCoverage: CoverageRatio | null;
};

function ratio(numerator: number, denominator: number): CoverageRatio {
    return {
        numerator,
        denominator,
        value: denominator === 0 ? null : numerator / denominator,
    };
}

/**
 * Geographic coverage and penetration for each selected Program with units
 * in the workbook, in `programIds` order. Never pooled across Programs.
 */
export function buildCoverageMetrics(
    figures: CoverageFigures,
    programIds: number[],
): ProgramCoverage[] {
    return programIds.flatMap(programId => {
        const units = figures.units.filter(u => u.programId === programId);
        if (units.length === 0) return [];
        const active = units.filter(u => u.status === 'Active').length;
        const targeted = units.filter(u => u.status === 'Targeted').length;
        return [
            {
                programId,
                geographicCoverage: ratio(active, active + targeted),
                penetration: ratio(active, units.length),
            },
        ];
    });
}

/**
 * The user metrics for one month: active users (counted from VectorCam) over
 * the month's expected users and over its projected devices (the target),
 * both from the workbook. A Program with neither figure is left out.
 */
export function buildUserCoverage(
    figures: CoverageFigures,
    month: MonthKey,
    activeByProgram: Map<number, number>,
): ProgramUserCoverage[] {
    return [...activeByProgram].flatMap(([programId, active]) => {
        const expected = figures.expectedUsers.find(
            row => row.programId === programId && row.month === month,
        );
        const target = figures.projectedDevices.find(
            row => row.programId === programId && row.month === month,
        );
        if (!expected && !target) return [];
        return [
            {
                programId,
                month,
                instantaneousUserCoverage: expected
                    ? ratio(active, expected.expected)
                    : null,
                programUserCoverage: target
                    ? ratio(active, target.projected)
                    : null,
            },
        ];
    });
}
