import type { Session } from '@/api/session/validation/session-schema';

// Practice and calibration runs are not surveillance output.
export function isCountedSession(session: Session): boolean {
    return (
        session.type === 'SURVEILLANCE' || session.type === 'DATA_COLLECTION'
    );
}

// A missing collectionDate falls back to upload time so the Record still
// shows up (failing capture date) instead of vanishing.
export function sessionBucketTime(session: Session): number {
    return session.collectionDate ?? session.submittedAt;
}
