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
                {
                    programId: 1,
                    unit: 'Gulu',
                    area: 'Gulu',
                    status: 'Active',
                    geometry,
                },
                {
                    programId: 1,
                    unit: 'Kaliro',
                    area: 'Kaliro',
                    status: 'Targeted',
                    geometry,
                },
                {
                    programId: 1,
                    unit: 'Kotido',
                    area: 'Kotido',
                    status: 'Targeted',
                    geometry,
                },
                {
                    programId: 1,
                    unit: 'Moyo',
                    area: 'Moyo',
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

    it('draws two Targeted sites in one area once, under the area name', () => {
        const site = (unit: string) => ({
            programId: 1,
            unit,
            area: 'Baringo',
            status: 'Targeted' as const,
            geometry,
        });
        const sites: CoverageResponse = {
            ...coverage,
            coverage: {
                ok: true,
                data: {
                    source: 'live',
                    savedAt: null,
                    liveProblem: null,
                    programs: [],
                    unmatched: [],
                    fills: [site('Barpello'), site('Kollowa')],
                },
            },
        };
        expect(
            buildUpcomingAreas(sites, new Set()).map(area => area.name),
        ).toEqual(['Baringo']);
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
