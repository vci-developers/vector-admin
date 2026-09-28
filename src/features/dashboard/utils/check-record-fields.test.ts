import type { Session } from '@/api/session/validation/session-schema';
import type { Specimen } from '@/api/specimen/validation/specimen-schema';
import { describe, expect, it } from 'vitest';
import { checkRecordFields } from './check-record-fields';

const session: Session = {
    sessionId: 1,
    deviceId: 1,
    siteId: 1,
    type: 'SURVEILLANCE',
    state: 'CERTIFIED',
    collectorName: 'Jane Doe',
    collectionDate: Date.UTC(2026, 0, 10),
    createdAt: Date.UTC(2026, 0, 10),
    submittedAt: Date.UTC(2026, 0, 11),
    latitude: 0.35, // Kampala
    longitude: 32.58,
};

const specimen: Specimen = {
    id: 1,
    sessionId: 1,
    images: [{ id: 1 }],
    thumbnailImage: { species: 'Anopheles gambiae' },
};

describe('checkRecordFields', () => {
    it('passes every field for a complete Uganda record', () => {
        expect(checkRecordFields(specimen, session, 'Uganda')).toEqual({
            species: true,
            captureDate: true,
            geolocation: true,
            operatorId: true,
        });
    });

    it('fails species without a thumbnail species', () => {
        expect(
            checkRecordFields(
                { ...specimen, thumbnailImage: { species: null } },
                session,
                'Uganda',
            ).species,
        ).toBe(false);
        expect(
            checkRecordFields(
                { ...specimen, thumbnailImage: null },
                session,
                'Uganda',
            ).species,
        ).toBe(false);
    });

    it('fails capture date when collectionDate is missing', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, collectionDate: null },
                'Uganda',
            ).captureDate,
        ).toBe(false);
    });

    it('fails geolocation for null GPS or GPS outside the country', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, latitude: null },
                'Uganda',
            ).geolocation,
        ).toBe(false);
        // Ahmedabad, India
        expect(
            checkRecordFields(
                specimen,
                { ...session, latitude: 23.04, longitude: 72.52 },
                'Uganda',
            ).geolocation,
        ).toBe(false);
    });

    it('fails geolocation for a Program country with no bounding box', () => {
        expect(checkRecordFields(specimen, session, 'TEST').geolocation).toBe(
            false,
        );
    });

    it('fails operator ID for a whitespace-only collectorName', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, collectorName: '   ' },
                'Uganda',
            ).operatorId,
        ).toBe(false);
    });
});
