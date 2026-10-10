import type { Program } from '@/api/program/validation/program-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { describe, expect, it } from 'vitest';
import {
    mergeLocationCoverage,
    progressLocationIdentity,
    progressLocationUnit,
    totalReportingLocations,
} from './progress-location-policy';

const program = (programId: number, country: string): Program => ({
    programId,
    country,
    name: 'Reporting program',
});
const site = (fields: Partial<Site> = {}): Site => ({
    siteId: 1,
    name: null,
    locationHierarchy: {},
    ...fields,
});

describe('progressLocationUnit', () => {
    it.each([
        [1, 'Uganda', 'household'],
        [2, 'Colombia', 'municipality'],
        [3, 'Ghana', 'household'],
        [4, 'Kenya', 'household'],
        [6, 'Cameroon', 'health-district'],
    ] as const)(
        'retains the reviewed unit for %s / %s, even without active sessions',
        (id, country, unit) => {
            expect(progressLocationUnit(program(id, country))).toBe(unit);
        },
    );

    it('does not apply a reviewed program policy to a different country', () => {
        expect(
            progressLocationUnit(program(1, 'Colombia'), [
                site({ villageName: 'Town A' }),
            ]),
        ).toBe('community');
    });

    it('derives the most specific registered unit for a new program and skips N/A placeholders', () => {
        const newProgram = program(20, 'Example');
        expect(
            progressLocationUnit(newProgram, [
                site({ villageName: 'Town A', houseNumber: ' N/A ' }),
            ]),
        ).toBe('community');
        expect(
            progressLocationUnit(newProgram, [
                site({ locationHierarchy: { Household: 'A1' } }),
            ]),
        ).toBe('household');
        expect(
            progressLocationUnit(newProgram, [
                site({ locationHierarchy: { 'Health District': 'North' } }),
            ]),
        ).toBe('health-district');
        expect(progressLocationUnit(newProgram, [site()])).toBe(
            'collection-site',
        );
    });
});

describe('progressLocationIdentity', () => {
    it('counts separate households in the same village, while duplicate aliases share an identity', () => {
        const uganda = program(1, 'Uganda');
        const legacy = site({
            district: 'Gulu',
            villageName: 'Aleu',
            houseNumber: 'H1',
        });
        const alias = site({
            siteId: 2,
            locationHierarchy: {
                District: ' gULU District ',
                'Town/Village': 'Aleu',
                'House Number': 'H1',
            },
        });
        const another = site({ ...legacy, siteId: 3, houseNumber: 'H2' });
        const first = progressLocationIdentity(uganda, 'household', legacy);
        expect(first).not.toBeNull();
        expect(progressLocationIdentity(uganda, 'household', alias)).toBe(
            first,
        );
        expect(progressLocationIdentity(uganda, 'household', another)).not.toBe(
            first,
        );
    });

    it('fills missing hierarchy levels from legacy fields without discarding existing ancestors', () => {
        const uganda = program(1, 'Uganda');
        const complete = site({
            locationHierarchy: {
                Region: 'Northern',
                District: 'Gulu',
                Village: 'Aleu',
                House: 'H1',
            },
        });
        const partial = site({
            district: 'Gulu',
            villageName: 'Aleu',
            houseNumber: 'H1',
            locationHierarchy: { Region: 'Northern', District: 'Gulu' },
        });
        expect(progressLocationIdentity(uganda, 'household', partial)).toBe(
            progressLocationIdentity(uganda, 'household', complete),
        );
    });

    it('counts Colombia municipal collection paths independently of household or trap descendants', () => {
        const colombia = program(2, 'Colombia');
        const first = site({
            district: 'North',
            villageName: 'Town A',
            houseNumber: 'H1',
        });
        const second = site({
            siteId: 2,
            locationHierarchy: {
                District: 'North',
                'Town/Village': 'Town A',
                Household: 'H2',
                Trap: 'T7',
            },
        });
        expect(progressLocationIdentity(colombia, 'municipality', first)).toBe(
            progressLocationIdentity(colombia, 'municipality', second),
        );
    });

    it('normalizes Colombia Department and Municipality hierarchy levels against legacy fields', () => {
        const colombia = program(2, 'Colombia');
        const legacy = site({ district: 'Antioquia', villageName: 'Turbo' });
        const hierarchy = site({
            locationHierarchy: {
                Departamento: 'Antioquia',
                Municipio: 'Turbo',
                Household: 'H1',
            },
        });
        expect(
            progressLocationIdentity(colombia, 'municipality', hierarchy),
        ).toBe(progressLocationIdentity(colombia, 'municipality', legacy));
        expect(
            progressLocationIdentity(colombia, 'municipality', hierarchy),
        ).not.toBeNull();
    });

    it('requires real leaf metadata instead of treating administrative parents as collection units', () => {
        expect(
            progressLocationIdentity(
                program(3, 'Ghana'),
                'household',
                site({
                    locationHierarchy: {
                        Region: 'Western',
                        District: 'Tarkwa',
                        'Town/Village': 'Tamso',
                        'Sentinel Site': 'School',
                    },
                }),
            ),
        ).toBeNull();
        expect(
            progressLocationIdentity(
                program(6, 'Cameroon'),
                'health-district',
                site({ locationHierarchy: { Region: 'North' } }),
            ),
        ).toBeNull();
        expect(
            progressLocationIdentity(
                program(1, 'Uganda'),
                'household',
                site({
                    district: 'Gulu',
                    villageName: 'Aleu',
                    houseNumber: 'N/A',
                }),
            ),
        ).toBeNull();
        expect(
            progressLocationIdentity(
                program(1, 'Uganda'),
                'household',
                undefined,
            ),
        ).toBeNull();
    });

    it('retains district and country context rather than merging matching household names geographically', () => {
        const uganda = program(1, 'Uganda');
        const north = site({
            district: 'Gulu',
            villageName: 'Town A',
            houseNumber: 'H1',
        });
        const south = site({ ...north, district: 'Lira' });
        const first = progressLocationIdentity(uganda, 'household', north);
        expect(progressLocationIdentity(uganda, 'household', south)).not.toBe(
            first,
        );
        expect(
            progressLocationIdentity(program(1, 'Kenya'), 'household', north),
        ).not.toBe(first);
        expect(
            progressLocationIdentity(
                uganda,
                'household',
                site({ houseNumber: 'H1' }),
            ),
        ).toBeNull();
    });

    it('counts recorded Health District leaves and skips their descendants', () => {
        const cameroon = program(6, 'Cameroon');
        const leaf = site({
            locationHierarchy: { Region: 'North', 'Health District': 'Lagdo' },
        });
        const descendant = site({
            siteId: 2,
            locationHierarchy: {
                Region: 'North',
                HealthDistrict: 'Lagdo',
                Village: 'Town A',
            },
        });
        expect(
            progressLocationIdentity(cameroon, 'health-district', leaf),
        ).not.toBeNull();
        expect(
            progressLocationIdentity(cameroon, 'health-district', descendant),
        ).toBe(progressLocationIdentity(cameroon, 'health-district', leaf));
    });

    it('does not split a Health District by ordinary District descendants or legacy descendant fields', () => {
        const cameroon = program(6, 'Cameroon');
        const parent = site({
            locationHierarchy: { Region: 'North', 'Health District': 'Lagdo' },
        });
        const ward = (name: string) =>
            site({
                district: name,
                locationHierarchy: {
                    ...parent.locationHierarchy,
                    District: name,
                },
            });
        const identity = progressLocationIdentity(
            cameroon,
            'health-district',
            parent,
        );
        expect(
            progressLocationIdentity(
                cameroon,
                'health-district',
                ward('Ward A'),
            ),
        ).toBe(identity);
        expect(
            progressLocationIdentity(
                cameroon,
                'health-district',
                ward('Ward B'),
            ),
        ).toBe(identity);
    });
});

describe('coverage combination', () => {
    it('merges each program and unit separately and propagates unavailable metadata', () => {
        const merged = mergeLocationCoverage([
            { programId: 3, unit: 'household', count: 2 },
            { programId: 1, unit: 'household', count: 4 },
            { programId: 3, unit: 'household', count: 3 },
            { programId: 6, unit: 'health-district', count: 2 },
            { programId: 1, unit: 'household', count: null },
        ]);
        expect(merged).toEqual([
            { programId: 1, unit: 'household', count: null },
            { programId: 3, unit: 'household', count: 5 },
            { programId: 6, unit: 'health-district', count: 2 },
        ]);
        expect(totalReportingLocations(merged)).toBeNull();
    });

    it('returns a total only for complete comparable units, preserving a true empty zero', () => {
        expect(
            totalReportingLocations([
                { programId: 1, unit: 'household', count: 2 },
                { programId: 3, unit: 'household', count: 4 },
            ]),
        ).toBe(6);
        expect(
            totalReportingLocations([
                { programId: 1, unit: 'household', count: 0 },
            ]),
        ).toBe(0);
        expect(totalReportingLocations([])).toBeNull();
        expect(
            totalReportingLocations([
                { programId: 1, unit: 'household', count: 2 },
                { programId: 2, unit: 'municipality', count: 4 },
            ]),
        ).toBeNull();
        expect(
            totalReportingLocations([
                { programId: 1, unit: 'household', count: null },
            ]),
        ).toBeNull();
    });
});
