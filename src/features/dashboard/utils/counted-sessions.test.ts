import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { Session } from '@/api/session/validation/session-schema';
import { describe, expect, it } from 'vitest';
import { scopeSnapshot } from './counted-sessions';

const session = (sessionId: number, fields: Partial<Session>): Session => ({
    sessionId,
    deviceId: 1,
    siteId: 1,
    type: 'SURVEILLANCE',
    collectorName: 'Jane Doe',
    collectionDate: 0,
    createdAt: 0,
    submittedAt: 0,
    latitude: null,
    longitude: null,
    ...fields,
});

const snapshot: ProgramSnapshot = {
    programId: 1,
    sessions: [
        session(1, {}),
        session(2, { type: 'DATA_COLLECTION' }),
        session(3, { type: 'PRACTICE' }),
        session(4, { siteId: 11 }),
    ],
    specimens: [],
    devices: [],
    collectionCycles: [],
    userLogins: [],
    sites: [
        { siteId: 1, name: null, district: 'Gulu', locationHierarchy: {} },
        {
            siteId: 11,
            name: null,
            district: 'Other',
            villageName: 'Other',
            locationHierarchy: {},
        },
    ],
    fetchedAt: 0,
};

const ids = (scoped: ProgramSnapshot) => scoped.sessions.map(s => s.sessionId);

describe('scopeSnapshot', () => {
    it('keeps the chosen Session types and leaves out the Test Site', () => {
        expect(
            ids(
                scopeSnapshot(snapshot, {
                    types: ['SURVEILLANCE', 'PRACTICE'],
                    testSites: false,
                }),
            ),
        ).toEqual([1, 3]);
    });

    it('keeps the Test Site when asked', () => {
        expect(
            ids(
                scopeSnapshot(snapshot, {
                    types: ['SURVEILLANCE'],
                    testSites: true,
                }),
            ),
        ).toEqual([1, 4]);
    });
});
