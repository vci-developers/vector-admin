import { describe, expect, it } from 'vitest';
import type { SpecimenGroup } from './build-specimen-points';
import {
    buildSpecimenFacets,
    filterDevices,
    filterSessions,
    summarizeSpecimens,
    type SpecimenFilter,
} from './filter-map-points';

const group = (
    species: string | null,
    count: number,
    sex: string | null = 'Female',
    abdomenStatus: string | null = 'Unfed',
): SpecimenGroup => ({ species, sex, abdomenStatus, count });

const session = (sessionId: number, specimenGroups: SpecimenGroup[]) => ({
    sessionId,
    specimenGroups,
    specimenCount: specimenGroups.reduce((sum, g) => sum + g.count, 0),
});

const DEFAULT: SpecimenFilter = {
    hiddenSpecies: [],
    hiddenSex: [],
    hiddenAbdomen: [],
    showNonMosquito: false,
    showZeroCatch: true,
};

const counts = (sessions: { sessionId: number; specimenCount: number }[]) =>
    sessions.map(s => [s.sessionId, s.specimenCount]);

describe('filterSessions', () => {
    const sessions = [
        session(1, [group('Anopheles gambiae', 3), group('Non-Mosquito', 2)]),
        session(2, [group('Non-Mosquito', 4)]),
        session(3, []),
        session(4, [group('Culex', 1, 'Male'), group(null, 2, null, null)]),
    ];

    it('hides Non-Mosquito by default and drops Sessions left empty by it', () => {
        expect(counts(filterSessions(sessions, DEFAULT))).toEqual([
            [1, 3],
            [3, 0],
            [4, 3],
        ]);
    });

    it('counts only the specimens that match every filter', () => {
        const filtered = filterSessions(sessions, {
            ...DEFAULT,
            hiddenSpecies: ['Culex'],
            hiddenSex: ['none'],
            showNonMosquito: true,
        });
        expect(counts(filtered)).toEqual([
            [1, 5],
            [2, 4],
            [3, 0],
        ]);
    });

    it('keeps only the matching specimen groups and counts the rest', () => {
        const [first] = filterSessions(sessions, DEFAULT);
        expect(first.specimenGroups).toEqual([group('Anopheles gambiae', 3)]);
        expect(first.hiddenBy).toEqual([
            { reason: { filter: 'nonMosquito' }, count: 2 },
        ]);
    });

    it('drops zero-catch Sessions when they are hidden', () => {
        const filtered = filterSessions(sessions, {
            ...DEFAULT,
            showZeroCatch: false,
        });
        expect(filtered.map(s => s.sessionId)).toEqual([1, 4]);
    });
});

describe('buildSpecimenFacets', () => {
    it('counts every value, keeping Non-Mosquito and unrecorded values apart', () => {
        const facets = buildSpecimenFacets([
            session(1, [group('Culex', 2), group('Non-Mosquito', 1)]),
            session(2, [group(null, 1, 'Male', null)]),
            session(3, []),
        ]);
        expect(Object.fromEntries(facets.species)).toEqual({
            Culex: 2,
            none: 1,
        });
        expect(Object.fromEntries(facets.sex)).toEqual({ Female: 3, Male: 1 });
        expect(Object.fromEntries(facets.abdomen)).toEqual({
            Unfed: 3,
            none: 1,
        });
        expect(facets.nonMosquito).toBe(1);
        expect(facets.zeroCatchSessions).toBe(1);
    });
});

describe('filterDevices', () => {
    it('keeps devices whose status is shown', () => {
        const devices = [
            { deviceId: 1, status: 'ACTIVE' as const },
            { deviceId: 2, status: 'INACTIVE' as const },
        ];
        expect(filterDevices(devices, ['ACTIVE'])).toEqual([devices[0]]);
    });
});

describe('summarizeSpecimens', () => {
    it('adds up species, sex and abdomen status, most common first', () => {
        const summary = summarizeSpecimens([
            session(1, [group('Culex', 1), group('Anopheles gambiae', 3)]),
            session(2, [group('Anopheles gambiae', 2, 'Male', null)]),
            session(3, []),
        ]);
        expect(summary).toEqual({
            sessions: 3,
            specimens: 6,
            hiddenSpecimens: 0,
            hiddenBy: [],
            species: [
                ['Anopheles gambiae', 5],
                ['Culex', 1],
            ],
            sex: [
                ['Female', 4],
                ['Male', 2],
            ],
            abdomen: [
                ['Unfed', 4],
                ['none', 2],
            ],
        });
    });
});

describe('summarizeSpecimens with filtered Sessions', () => {
    it('adds up the specimens the filters hid, by the filter that hid them', () => {
        const filtered = filterSessions(
            [
                session(1, [
                    group('Culex', 2),
                    group('Non-Mosquito', 3),
                    group(null, 1),
                ]),
                session(2, [group('Culex', 1), group(null, 4, 'Male')]),
            ],
            { ...DEFAULT, hiddenSpecies: ['none'], hiddenSex: ['Male'] },
        );
        const summary = summarizeSpecimens(filtered);
        expect(summary.specimens).toBe(3);
        expect(summary.hiddenSpecimens).toBe(8);
        expect(summary.hiddenBy).toEqual([
            { reason: { filter: 'species', value: 'none' }, count: 5 },
            { reason: { filter: 'nonMosquito' }, count: 3 },
        ]);
    });
});
