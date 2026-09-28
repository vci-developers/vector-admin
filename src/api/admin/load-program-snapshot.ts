import 'server-only';

import { adminGet, adminGetAll } from '@/api/admin/admin-client';
import {
    getCollectionCyclesResponseSchema,
    type CollectionCycle,
} from '@/api/collection-cycle/validation/collection-cycle-schema';
import {
    getDevicesPageSchema,
    type Device,
} from '@/api/device/validation/device-schema';
import {
    getSessionsPageSchema,
    type Session,
} from '@/api/session/validation/session-schema';
import {
    getSpecimensPageSchema,
    type Specimen,
} from '@/api/specimen/validation/specimen-schema';
import {
    getLoginActivityResponseSchema,
    type UserLoginActivity,
} from '@/api/user/validation/login-activity-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';

export type ProgramSnapshot = {
    programId: number;
    sessions: Session[];
    specimens: Specimen[];
    devices: Device[];
    collectionCycles: CollectionCycle[];
    userLogins: UserLoginActivity[];
    fetchedAt: number;
};

// Wide enough to cover every cycle; the endpoint requires a range.
const ALL_CYCLES_RANGE = { startDate: '2000-01-01', endDate: '2100-01-01' };

// All login history; per-user totals cover the whole range, so limit=1 skips
// the raw event rows.
function loginActivityQuery(programId: number) {
    return {
        eventType: 'login',
        programId,
        startDate: '2020-01-01',
        endDate: new Date().toISOString().slice(0, 10),
        limit: 1,
    };
}

// Cache failures briefly so the next load retries.
function failBriefly(error: NetworkError) {
    cacheLife('seconds');
    return err(error);
}

export function programSnapshotTag(programId: number): string {
    return `program-snapshot-${programId}`;
}

export async function loadProgramSnapshot(
    programId: number,
): Promise<Result<ProgramSnapshot, NetworkError>> {
    'use cache';
    cacheTag(programSnapshotTag(programId));

    const [sessions, specimens, devices, cycles, logins] = await Promise.all([
        adminGetAll('/sessions/', { programId }, getSessionsPageSchema),
        adminGetAll(
            '/specimens/',
            { programId, includeAllImages: true },
            getSpecimensPageSchema,
        ),
        adminGetAll('/devices/', { programId }, getDevicesPageSchema),
        adminGet(
            `/programs/${programId}/collection-cycles`,
            ALL_CYCLES_RANGE,
            getCollectionCyclesResponseSchema,
        ),
        adminGet(
            '/users/auth-events',
            loginActivityQuery(programId),
            getLoginActivityResponseSchema,
        ),
    ]);

    if (!sessions.ok) return failBriefly(sessions.error);
    if (!specimens.ok) return failBriefly(specimens.error);
    if (!devices.ok) return failBriefly(devices.error);
    if (!cycles.ok) return failBriefly(cycles.error);
    if (!logins.ok) return failBriefly(logins.error);

    // Past an hour, serve the stale snapshot while a fresh one loads.
    cacheLife('hours');

    return ok({
        programId,
        sessions: sessions.data,
        specimens: specimens.data,
        devices: devices.data,
        collectionCycles: cycles.data.collectionCycles,
        userLogins: logins.data.users,
        fetchedAt: Date.now(),
    });
}
