import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Session } from '@/api/session/validation/session-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { buildSpecimenPoints } from './build-specimen-points';

const JAN_10 = Date.UTC(2026, 0, 10);

function session(sessionId: number, overrides: Partial<Session> = {}): Session {
    return {
        sessionId,
        deviceId: 1,
        siteId: 1,
        type: 'SURVEILLANCE',
        state: 'CERTIFIED',
        collectorName: 'Jane Doe',
        collectionDate: JAN_10,
        createdAt: JAN_10,
        submittedAt: JAN_10,
        latitude: 0.35,
        longitude: 32.58,
        ...overrides,
    };
}

const specimen = (id: number, sessionId: number): Specimen => ({
    id,
    sessionId,
    images: [{ id }],
    thumbnailImage: { species: 'Culex' },
});

function snapshot(sessions: Session[], specimens: Specimen[]): ProgramSnapshot {
    return {
        programId: 7,
        sessions,
        specimens,
        devices: [],
        collectionCycles: [],
        userLogins: [],
        sites: [],
        fetchedAt: 0,
    };
}

describe('buildSpecimenPoints', () => {
    it("places each of the month's Sessions with its specimen count", () => {
        const points = buildSpecimenPoints(
            snapshot(
                [
                    session(1),
                    session(2),
                    session(3, { collectionDate: Date.UTC(2026, 1, 2) }),
                ],
                [specimen(1, 1), specimen(2, 1), specimen(3, 3)],
            ),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(points.placed.map(p => [p.sessionId, p.specimenCount])).toEqual([
            [1, 2],
            [2, 0],
        ]);
    });

    it('counts Sessions without in-country GPS instead of drawing them', () => {
        const points = buildSpecimenPoints(
            snapshot(
                [
                    session(1, { latitude: null, longitude: null }),
                    session(2, { latitude: 23.04, longitude: 72.52 }),
                ],
                [specimen(1, 1), specimen(2, 2), specimen(3, 2)],
            ),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(points.placed).toEqual([]);
        expect(
            points.unplaced.map(u => [u.sessionId, u.siteId, u.specimenCount]),
        ).toEqual([
            [1, 1, 1],
            [2, 1, 2],
        ]);
    });

    it('covers every month of the period', () => {
        const points = buildSpecimenPoints(
            snapshot(
                [
                    session(1),
                    session(2, { collectionDate: Date.UTC(2026, 1, 2) }),
                    session(3, { collectionDate: Date.UTC(2026, 2, 2) }),
                ],
                [],
            ),
            'Uganda',
            { from: '2026-01', to: '2026-02' },
        );

        expect(points.placed.map(p => p.sessionId)).toEqual([1, 2]);
    });

    it('numbers collectors per person, as every user figure matches names', () => {
        const points = buildSpecimenPoints(
            snapshot(
                [
                    session(1, { collectorName: 'Jane Doe' }),
                    session(2, { collectorName: ' jane  DOE ' }),
                    session(3, { collectorName: 'Jane Doe and Ana García' }),
                    session(4, { collectorName: '  ' }),
                    session(5, {
                        collectorName: 'Ana Garcia',
                        latitude: null,
                        longitude: null,
                    }),
                ],
                [],
            ),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(points.placed.map(p => p.collectorIds)).toEqual([
            [1],
            [1],
            [1, 2],
            [],
        ]);
        expect(points.unplaced.map(u => u.collectorIds)).toEqual([[2]]);
    });
});
