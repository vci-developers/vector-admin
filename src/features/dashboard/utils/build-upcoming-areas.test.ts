import type { CoverageResponse } from '@/api/coverage/validation/coverage-schema';
import { describe, expect, it } from 'vitest';
import { buildUpcomingAreas } from './build-upcoming-areas';

const geometry = {
    type: 'MultiPolygon' as const,
    coordinates: [
        [
            [
                [33, 1],
                [34, 1],
                [34, 2],
                [33, 1],
            ] as [number, number][],
        ],
    ],
};

const coverage: CoverageResponse = {
    viewer: 'stakeholder',
    programs: [{ programId: 1, name: 'NMED', country: 'Uganda' }],
    outlines: [],
    coverage: {
        ok: true,
        data: {
            source: 'saved',
            savedAt: null,
            liveProblem: null,
            programs: [],
            unmatched: [],
            fills: [
                { programId: 1, unit: 'Gulu', status: 'Active', geometry },
                { programId: 1, unit: 'Kaliro', status: 'Targeted', geometry },
                { programId: 1, unit: 'Kotido', status: 'Targeted', geometry },
                {
                    programId: 1,
                    unit: 'Moyo',
                    status: 'Surveillance only',
                    geometry,
                },
            ],
        },
    },
};

describe('buildUpcomingAreas', () => {
    it('keeps Targeted units that do not report yet', () => {
        expect(
            buildUpcomingAreas(coverage, new Set(['uganda:kotido'])).map(
                area => area.key,
            ),
        ).toEqual(['uganda:kaliro']);
    });

    it('is empty when the workbook could not be read', () => {
        expect(
            buildUpcomingAreas(
                { ...coverage, coverage: { ok: false, error: 'offline' } },
                new Set(),
            ),
        ).toEqual([]);
    });
});
