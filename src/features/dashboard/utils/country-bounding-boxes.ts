type BoundingBox = {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
};

// Keyed by Program Country as the API spells it. Boxes are rectangles, so
// points just across a border can still pass.
const COUNTRY_BOUNDING_BOXES: Record<string, BoundingBox> = {
    Uganda: { minLat: -1.48, maxLat: 4.23, minLng: 29.57, maxLng: 35.04 },
    Kenya: { minLat: -4.68, maxLat: 5.51, minLng: 33.91, maxLng: 41.91 },
    Ghana: { minLat: 4.74, maxLat: 11.17, minLng: -3.26, maxLng: 1.2 },
    Cameroon: { minLat: 1.65, maxLat: 13.08, minLng: 8.49, maxLng: 16.19 },
    Colombia: { minLat: -4.23, maxLat: 13.39, minLng: -81.73, maxLng: -66.87 },
    // Contiguous states only
    'United States of America': {
        minLat: 24.52,
        maxLat: 49.38,
        minLng: -124.77,
        maxLng: -66.95,
    },
};

export function isInsideCountry(
    latitude: number | null,
    longitude: number | null,
    country: string,
): boolean {
    const box = COUNTRY_BOUNDING_BOXES[country];
    if (!box || latitude === null || longitude === null) return false;
    return (
        latitude >= box.minLat &&
        latitude <= box.maxLat &&
        longitude >= box.minLng &&
        longitude <= box.maxLng
    );
}

// ISO 3166-1 alpha-2 codes, used to keep geocoder matches inside the country.
const COUNTRY_CODES: Record<string, string> = {
    Uganda: 'ug',
    Kenya: 'ke',
    Ghana: 'gh',
    Cameroon: 'cm',
    Colombia: 'co',
    'United States of America': 'us',
};

export function countryCode(country: string): string | undefined {
    return COUNTRY_CODES[country];
}
