import 'server-only';

import { adminGet } from '@/api/admin/admin-client';
import { loadProgressPages } from '@/api/progress/load-progress-pages';
import {
    getCollectionCyclesResponseSchema,
    type CollectionCycle,
} from '@/api/collection-cycle/validation/collection-cycle-schema';
import {
    progressSessionsPageSchema,
    progressSpecimensPageSchema,
    type ProgressSession,
    type ProgressSpecimen,
} from '@/api/progress/validation/progress-snapshot-schema';
import {
    getSitesPageSchema,
    type Site,
} from '@/api/site/validation/site-schema';
import type { NetworkError } from '@/lib/network/network-error';
import { err, ok, type Result } from '@/lib/result/result';
import { cacheLife, cacheTag } from 'next/cache';

export type ProgressSnapshot = {
    programId: number;
    sessions: ProgressSession[];
    specimens: ProgressSpecimen[];
    sites: Site[];
    collectionCycles: CollectionCycle[];
    fetchedAt: number;
};

type SnapshotResult = Result<ProgressSnapshot, NetworkError>;
const inFlight = new Map<number, Promise<SnapshotResult>>();
const STABLE_SORT = { sortBy: 'id', sortOrder: 'asc' };
// The API filters one session type at a time; types are chosen in the builder.
const SNAPSHOT_VERSION = 'image-count-v1-all-types-species';

function failBriefly(error: NetworkError) {
    cacheLife('seconds');
    return err(error);
}

export function progressSnapshotTag(programId: number): string {
    return `program-progress-${programId}`;
}

export function loadProgressSnapshot(
    programId: number,
): Promise<SnapshotResult> {
    const pending =
        inFlight.get(programId) ??
        loadCachedProgressSnapshot(programId, SNAPSHOT_VERSION).finally(() =>
            inFlight.delete(programId),
        );
    inFlight.set(programId, pending);
    return pending;
}

async function loadCachedProgressSnapshot(
    programId: number,
    snapshotVersion: typeof SNAPSHOT_VERSION,
): Promise<SnapshotResult> {
    'use cache';
    // The version is an explicit cache-key argument: older specimen-count
    // snapshots cannot be reused when complete image lists are required.
    const programTag = progressSnapshotTag(programId);
    cacheTag(programTag, `${programTag}:${snapshotVersion}`);

    const [sessions, specimens, sites, cycles] = await Promise.all([
        loadProgressPages(
            '/sessions/',
            { programId, ...STABLE_SORT },
            progressSessionsPageSchema,
            session => session.sessionId,
        ),
        loadProgressPages(
            '/specimens/',
            {
                programId,
                hasImages: true,
                includeAllImages: true,
                ...STABLE_SORT,
            },
            progressSpecimensPageSchema,
            specimen => specimen.id,
        ),
        loadProgressPages(
            '/sites/',
            { programId, ...STABLE_SORT },
            getSitesPageSchema,
            site => site.siteId,
        ),
        adminGet(
            `/programs/${programId}/collection-cycles`,
            { startDate: '2000-01-01', endDate: '2100-01-01' },
            getCollectionCyclesResponseSchema,
        ),
    ]);

    if (!sessions.ok) return failBriefly(sessions.error);
    if (!specimens.ok) return failBriefly(specimens.error);
    if (!sites.ok) return failBriefly(sites.error);
    if (!cycles.ok) return failBriefly(cycles.error);

    cacheLife('hours');
    return ok({
        programId,
        sessions: sessions.data,
        specimens: specimens.data,
        sites: sites.data,
        collectionCycles: cycles.data.collectionCycles,
        fetchedAt: Date.now(),
    });
}
