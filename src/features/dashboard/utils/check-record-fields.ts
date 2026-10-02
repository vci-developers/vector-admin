import type { Session } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { isInsideCountry } from './country-bounding-boxes';
import { isSiteUnderTopLevel } from './site-location-path';

export const REQUIRED_FIELDS = [
    'species',
    'captureDate',
    'geolocation',
    'operatorId',
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export type RecordFieldChecks = Record<RequiredField, boolean>;

/**
 * The Session has a location: its Site's District (or other top-level place),
 * or failing that its GPS inside the Program's country.
 */
export function hasLocation(
    session: Session,
    site: Site | undefined,
    country: string,
): boolean {
    return (
        isSiteUnderTopLevel(site) ||
        isInsideCountry(session.latitude, session.longitude, country)
    );
}

export function checkRecordFields(
    specimen: Specimen,
    session: Session,
    site: Site | undefined,
    country: string,
): RecordFieldChecks {
    return {
        species: Boolean(specimen.thumbnailImage?.species?.trim()),
        captureDate: session.collectionDate !== null,
        geolocation: hasLocation(session, site, country),
        operatorId: session.collectorName.trim() !== '',
    };
}
