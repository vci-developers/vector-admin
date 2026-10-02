import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { SessionState } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { siteLocationPath, type LocationLevel } from './build-location-tree';
import { checkRecordFields } from './check-record-fields';
import { isCountedSession, sessionBucketTime } from './counted-sessions';
import { isInsideCountry } from './country-bounding-boxes';
import { monthKeyOf, programTimeZone, type MonthKey } from './month-key';

export type SessionMissingFields = {
    /** Specimens without a thumbnail species. */
    species: number;
    captureDate: boolean;
    geolocation: boolean;
    operatorId: boolean;
};

export type ProgramSession = {
    sessionId: number;
    state: SessionState | null;
    isCertified: boolean;
    deviceId: number;
    siteId: number;
    /** Null when the Site is unknown or has no name or place fields. */
    siteName: string | null;
    /** The Site's place names, broadest first; empty when unknown. */
    location: LocationLevel[];
    /** "Entered by": the collector named on the Session's metadata form. */
    collectorName: string;
    collectorTitle: string | null;
    /** "Date entered": when the Session was created on the phone. */
    createdAt: number | null;
    collectionDate: number | null;
    submittedAt: number;
    /** Milliseconds from createdAt to certifiedAt; null until certified. */
    timeToConfirmation: number | null;
    specimenCount: number;
    missing: SessionMissingFields;
};

const CERTIFIED_STATES: SessionState[] = ['CERTIFIED', 'SUBMITTED'];

// Legacy Sites often have no name, only village and district.
function siteDisplayName(site: Site | undefined): string | null {
    if (!site) return null;
    if (site.name?.trim()) return site.name.trim();
    const place = [site.villageName, site.district]
        .map(part => part?.trim())
        .filter(Boolean)
        .join(', ');
    return place || null;
}

export function buildProgramSessions(
    snapshot: ProgramSnapshot,
    country: string,
    period: { from: MonthKey; to: MonthKey },
): ProgramSession[] {
    const timeZone = programTimeZone(snapshot.collectionCycles);
    const sessions = snapshot.sessions.filter(session => {
        const month = monthKeyOf(sessionBucketTime(session), timeZone);
        return (
            isCountedSession(session) &&
            month >= period.from &&
            month <= period.to
        );
    });
    const sitesById = new Map(snapshot.sites.map(site => [site.siteId, site]));
    const specimensBySession = Map.groupBy(
        snapshot.specimens,
        specimen => specimen.sessionId,
    );

    const rows = sessions.map(session => {
        const specimens = specimensBySession.get(session.sessionId) ?? [];
        const certifiedAt = session.certifiedBy?.certifiedAt ?? null;
        const site = sitesById.get(session.siteId);
        return {
            sessionId: session.sessionId,
            state: session.state ?? null,
            isCertified:
                !!session.state && CERTIFIED_STATES.includes(session.state),
            deviceId: session.deviceId,
            siteId: session.siteId,
            siteName: siteDisplayName(site),
            location: site ? siteLocationPath(site) : [],
            collectorName: session.collectorName.trim(),
            collectorTitle: session.collectorTitle?.trim() || null,
            createdAt: session.createdAt,
            collectionDate: session.collectionDate,
            submittedAt: session.submittedAt,
            timeToConfirmation:
                certifiedAt !== null && session.createdAt !== null
                    ? certifiedAt - session.createdAt
                    : null,
            specimenCount: specimens.length,
            missing: {
                species: specimens.filter(
                    specimen =>
                        !checkRecordFields(specimen, session, country).species,
                ).length,
                captureDate: session.collectionDate === null,
                geolocation: !isInsideCountry(
                    session.latitude,
                    session.longitude,
                    country,
                ),
                operatorId: session.collectorName.trim() === '',
            },
        };
    });

    // Uncertified first so stuck reviews surface, then oldest first.
    return rows.sort(
        (a, b) =>
            Number(a.isCertified) - Number(b.isCertified) ||
            sessionSortTime(a) - sessionSortTime(b),
    );
}

function sessionSortTime(row: ProgramSession): number {
    return row.collectionDate ?? row.submittedAt;
}
