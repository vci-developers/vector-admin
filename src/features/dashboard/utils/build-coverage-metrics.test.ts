import { describe, expect, it } from 'vitest';
import {
    buildCoverageMetrics,
    buildUserCoverage,
} from './build-coverage-metrics';
import type {
    CoverageFigures,
    CoverageStatus,
    CoverageUnit,
} from './parse-coverage-sheets';

function units(
    programId: number,
    counts: Partial<Record<CoverageStatus, number>>,
): CoverageUnit[] {
    return Object.entries(counts).flatMap(([status, count]) =>
        Array.from({ length: count }, (_, i) => ({
            programId,
            unit: `${status} ${i}`,
            status: status as CoverageStatus,
            boundary: null,
        })),
    );
}

const uganda: CoverageFigures = {
    units: units(1, { Active: 11, Targeted: 3, 'Surveillance only': 8 }),
    expectedUsers: [
        { programId: 1, month: '2026-08', expected: 48 },
        { programId: 1, month: '2026-09', expected: 66 },
    ],
    programPotential: [{ programId: 1, programPotential: 84 }],
    projectedDevices: [],
};

describe('buildCoverageMetrics', () => {
    it("gives Uganda's 11 / 14 and 11 / 22", () => {
        expect(buildCoverageMetrics(uganda, [1])).toEqual([
            {
                programId: 1,
                geographicCoverage: {
                    numerator: 11,
                    denominator: 14,
                    value: 11 / 14,
                },
                penetration: { numerator: 11, denominator: 22, value: 0.5 },
            },
        ]);
    });

    it('leaves out Programs not selected or with no units', () => {
        expect(buildCoverageMetrics(uganda, [2])).toEqual([]);
        expect(buildCoverageMetrics(uganda, [])).toEqual([]);
    });

    it('keeps each Program separate, in the order given', () => {
        const figures: CoverageFigures = {
            ...uganda,
            units: [...uganda.units, ...units(4, { Active: 5, Targeted: 5 })],
        };

        const coverage = buildCoverageMetrics(figures, [4, 1]);

        expect(coverage.map(c => c.programId)).toEqual([4, 1]);
        expect(coverage[0].geographicCoverage?.value).toBe(0.5);
        expect(coverage[1].geographicCoverage?.value).toBe(11 / 14);
    });

    it('gives no value, not zero, when a denominator is 0', () => {
        const [coverage] = buildCoverageMetrics(
            { ...uganda, units: units(1, { 'Surveillance only': 2 }) },
            [1],
        );

        expect(coverage.geographicCoverage).toEqual({
            numerator: 0,
            denominator: 0,
            value: null,
        });
        expect(coverage.penetration?.value).toBe(0);
    });
});

describe('buildUserCoverage', () => {
    it("divides the month's active users by its expected users and the Program's potential", () => {
        expect(
            buildUserCoverage(uganda, '2026-09', new Map([[1, 52]])),
        ).toEqual([
            {
                programId: 1,
                month: '2026-09',
                instantaneousUserCoverage: {
                    numerator: 52,
                    denominator: 66,
                    value: 52 / 66,
                },
                programUserCoverage: {
                    numerator: 52,
                    denominator: 84,
                    value: 52 / 84,
                },
            },
        ]);
    });

    it("uses the month's expected users and the same potential every month", () => {
        const [august] = buildUserCoverage(
            uganda,
            '2026-08',
            new Map([[1, 43]]),
        );
        expect(august.instantaneousUserCoverage?.denominator).toBe(48);
        expect(august.programUserCoverage?.denominator).toBe(84);
    });

    it('leaves a ratio out when its figure is missing', () => {
        const [december] = buildUserCoverage(
            uganda,
            '2026-12',
            new Map([[1, 70]]),
        );
        expect(december.instantaneousUserCoverage).toBeNull();
        expect(december.programUserCoverage?.denominator).toBe(84);
        const [kenya] = buildUserCoverage(
            {
                ...uganda,
                programPotential: [],
                expectedUsers: [
                    { programId: 4, month: '2026-10', expected: 14 },
                ],
            },
            '2026-10',
            new Map([[4, 3]]),
        );
        expect(kenya.programUserCoverage).toBeNull();
    });

    it('leaves out a Program with no user figures', () => {
        expect(buildUserCoverage(uganda, '2026-09', new Map([[4, 3]]))).toEqual(
            [],
        );
    });
});
