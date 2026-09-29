import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Session } from '@/api/session/validation/session-schema';
import { describe, expect, it } from 'vitest';
import { buildProgramSessions } from './build-program-sessions';

const HOUR = 60 * 60 * 1000;
const JAN_10 = Date.UTC(2026, 0, 10);

function session(sessionId: number, overrides: Partial<Session> = {}): Session {
    return {
        sessionId,
        deviceId: 1,
        siteId: 1,
        type: 'SURVEILLANCE',
        state: 'NEEDS_REVIEW',
        collectorName: 'Jane Doe',
        collectionDate: JAN_10,
        createdAt: JAN_10,
        submittedAt: JAN_10 + HOUR,
        latitude: 0.35,
        longitude: 32.58,
        ...overrides,
    };
}

function snapshot(overrides: Partial<ProgramSnapshot>): ProgramSnapshot {
    return {
        programId: 1,
        sessions: [],
        specimens: [],
        devices: [],
        collectionCycles: [],
        userLogins: [],
        sites: [],
        fetchedAt: 0,
        ...overrides,
    };
}

describe('buildProgramSessions', () => {
    it('lists uncertified Sessions first, each group oldest first', () => {
        const rows = buildProgramSessions(
            snapshot({
                sessions: [
                    session(1, { state: 'CERTIFIED', collectionDate: JAN_10 }),
                    session(2, {
                        state: 'NEEDS_REVIEW',
                        collectionDate: JAN_10 + 2 * HOUR,
                    }),
                    session(3, {
                        state: 'IN_REVIEW',
                        collectionDate: JAN_10 + HOUR,
                    }),
                    session(4, {
                        state: 'SUBMITTED',
                        collectionDate: JAN_10 - HOUR,
                    }),
                ],
            }),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(rows.map(row => row.sessionId)).toEqual([3, 2, 4, 1]);
    });

    it('keeps only counted Sessions from the requested month', () => {
        const rows = buildProgramSessions(
            snapshot({
                sessions: [
                    session(1),
                    session(2, { type: 'PRACTICE' }),
                    session(3, { collectionDate: Date.UTC(2026, 1, 3) }),
                ],
            }),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(rows.map(row => row.sessionId)).toEqual([1]);
    });

    it('measures Time to Confirmation from createdAt to certifiedAt', () => {
        const [certified, pending] = buildProgramSessions(
            snapshot({
                sessions: [
                    session(1, {
                        state: 'CERTIFIED',
                        certifiedBy: { certifiedAt: JAN_10 + 5 * HOUR },
                    }),
                    session(2),
                ],
            }),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        ).sort((a, b) => a.sessionId - b.sessionId);

        expect(certified.timeToConfirmation).toBe(5 * HOUR);
        expect(pending.timeToConfirmation).toBeNull();
    });

    it('reports which Required Metadata Fields are missing', () => {
        const [row] = buildProgramSessions(
            snapshot({
                sessions: [session(1, { collectorName: ' ', latitude: null })],
                specimens: [
                    {
                        id: 1,
                        sessionId: 1,
                        images: [],
                        thumbnailImage: { species: 'Culex' },
                    },
                    { id: 2, sessionId: 1, images: [], thumbnailImage: null },
                ],
            }),
            'Uganda',
            { from: '2026-01', to: '2026-01' },
        );

        expect(row.specimenCount).toBe(2);
        expect(row.missing).toEqual({
            species: 1,
            captureDate: false,
            geolocation: true,
            operatorId: true,
        });
    });
});
