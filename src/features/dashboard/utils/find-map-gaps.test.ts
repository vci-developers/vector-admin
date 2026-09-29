import { describe, expect, it } from 'vitest';
import { findMapGaps } from './find-map-gaps';

const s = (programId: number, specimenCount = 1) => ({
    programId,
    specimenCount,
});
const d = (programId: number) => ({ programId });

describe('findMapGaps', () => {
    it('explains each Program missing from the specimens layer', () => {
        const gaps = findMapGaps({
            programIds: [1, 2, 3, 4],
            sessions: {
                all: [s(1), s(2, 5), s(2, 3), s(3), s(4)],
                shown: [s(1), s(3), s(4)],
                placed: [s(1), s(4)],
            },
            devices: null,
        });

        expect(gaps).toEqual([
            {
                programId: 2,
                specimens: { kind: 'filtered', specimens: 8, sessions: 2 },
                devices: null,
            },
            {
                programId: 3,
                specimens: { kind: 'noLocation', sessions: 1 },
                devices: null,
            },
        ]);
    });

    it('names a Program with no Sessions in the period', () => {
        const gaps = findMapGaps({
            programIds: [1],
            sessions: { all: [], shown: [], placed: [] },
            devices: null,
        });
        expect(gaps[0].specimens).toEqual({ kind: 'noSessions' });
    });

    it('explains devices hidden by the status filter or without a location', () => {
        const gaps = findMapGaps({
            programIds: [1, 2, 3],
            sessions: null,
            devices: {
                all: [d(1), d(1), d(2), d(3)],
                shown: [d(2), d(3)],
                placed: [d(3)],
            },
        });
        expect(gaps.map(gap => [gap.programId, gap.devices])).toEqual([
            [1, { kind: 'filtered', devices: 2 }],
            [2, { kind: 'noLocation', devices: 1 }],
        ]);
    });

    it('ignores layers that are off', () => {
        expect(
            findMapGaps({ programIds: [1], sessions: null, devices: null }),
        ).toEqual([]);
    });
});
