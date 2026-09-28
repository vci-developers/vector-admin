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
            '2026-01',
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
            '2026-01',
        );

        expect(points).toEqual({
            placed: [],
            unplacedSessions: 2,
            unplacedSpecimens: 3,
        });
    });

    it('leaves out practice Sessions', () => {
        const points = buildSpecimenPoints(
            snapshot([session(1, { type: 'PRACTICE' })], [specimen(1, 1)]),
            'Uganda',
            '2026-01',
        );

        expect(points.placed).toEqual([]);
        expect(points.unplacedSessions).toBe(0);
    });
});
