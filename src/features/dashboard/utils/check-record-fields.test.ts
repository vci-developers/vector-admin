import type { Session } from '@/api/session/validation/session-schema';
import type { Site } from '@/api/site/validation/site-schema';
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

const site: Site = {
    siteId: 1,
    name: null,
    district: 'Gulu',
    villageName: 'Lacor',
    locationHierarchy: {},
};

const specimen: Specimen = {
    id: 1,
    sessionId: 1,
    images: [{ id: 1 }],
    thumbnailImage: { species: 'Anopheles gambiae' },
};

describe('checkRecordFields', () => {
    it('passes every field for a complete record', () => {
        expect(checkRecordFields(specimen, session, site, 'Uganda')).toEqual({
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
                site,
                'Uganda',
            ).species,
        ).toBe(false);
        expect(
            checkRecordFields(
                { ...specimen, thumbnailImage: null },
                session,
                site,
                'Uganda',
            ).species,
        ).toBe(false);
    });

    it('fails capture date when collectionDate is missing', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, collectionDate: null },
                site,
                'Uganda',
            ).captureDate,
        ).toBe(false);
    });

    it('passes location for a Site under a District whatever its GPS', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, latitude: null },
                {
                    ...site,
                    district: null,
                    locationHierarchy: { Region: 'Ashanti' },
                },
                'Ghana',
            ).geolocation,
        ).toBe(true);
    });

    it('falls back to GPS inside the country when the Site has no District', () => {
        const noDistrict = { ...site, district: 'Other', villageName: 'Other' };
        const at = (fields: Partial<Session>, s?: Site) =>
            checkRecordFields(specimen, { ...session, ...fields }, s, 'Uganda')
                .geolocation;
        expect(at({}, noDistrict)).toBe(true);
        expect(at({}, undefined)).toBe(true);
        // Ahmedabad, India
        expect(at({ latitude: 23.04, longitude: 72.52 }, noDistrict)).toBe(
            false,
        );
        expect(at({ latitude: null }, undefined)).toBe(false);
    });

    it('fails operator ID for a whitespace-only collectorName', () => {
        expect(
            checkRecordFields(
                specimen,
                { ...session, collectorName: '   ' },
                site,
                'Uganda',
            ).operatorId,
        ).toBe(false);
    });
});
