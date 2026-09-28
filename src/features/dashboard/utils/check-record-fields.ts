import type { Session } from '@/api/session/validation/session-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { isInsideCountry } from './country-bounding-boxes';

export const REQUIRED_FIELDS = [
    'species',
    'captureDate',
    'geolocation',
    'operatorId',
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export type RecordFieldChecks = Record<RequiredField, boolean>;

export function checkRecordFields(
    specimen: Specimen,
    session: Session,
    country: string,
): RecordFieldChecks {
    return {
        species: Boolean(specimen.thumbnailImage?.species?.trim()),
        captureDate: session.collectionDate !== null,
        geolocation: isInsideCountry(
            session.latitude,
            session.longitude,
            country,
        ),
        operatorId: session.collectorName.trim() !== '',
    };
}
