import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type {
    Session,
    SessionType,
} from '@/api/session/validation/session-schema';
import { isTestSite } from './site-location-path';

/** The page-wide Session filter: which Session types, and Test Sites or not. */
export type SessionScope = { types: SessionType[]; testSites: boolean };

/** The snapshot with only its Counted Sessions: those in the scope. */
export function scopeSnapshot(
    snapshot: ProgramSnapshot,
    { types, testSites }: SessionScope,
): ProgramSnapshot {
    const testSiteIds = new Set(
        snapshot.sites.filter(isTestSite).map(site => site.siteId),
    );
    return {
        ...snapshot,
        sessions: snapshot.sessions.filter(
            session =>
                types.includes(session.type) &&
                (testSites || !testSiteIds.has(session.siteId)),
        ),
    };
}

// A missing collectionDate falls back to upload time so the Record still
// shows up (failing capture date) instead of vanishing.
export function sessionBucketTime(session: Session): number {
    return session.collectionDate ?? session.submittedAt;
}
