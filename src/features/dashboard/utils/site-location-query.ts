import type { Site } from '@/api/site/validation/site-schema';

// Ported from VectorVerify's geographical summary (buildSiteLocationQuery).
// Legacy Sites carry village/parish/district fields; newer ones a hierarchy.
export function isLegacySite(site: Site): boolean {
    return Object.keys(site.locationHierarchy).length === 0;
}

function buildLegacyQuery(site: Site, country: string): string {
    const { villageName, parish, subCounty, district } = site;
    const cleanDistrict = district?.replace(/ District$/i, '').trim();
    const countryPart = cleanDistrict
        ? `${cleanDistrict}, ${country}`
        : country;

    let cleanVillage = villageName?.split('+')[0]?.trim() ?? null;
    if (
        cleanVillage &&
        (cleanVillage.toLowerCase() === subCounty?.toLowerCase() ||
            cleanVillage.toLowerCase() === parish?.toLowerCase())
    ) {
        cleanVillage = cleanVillage
            .replace(/ Subcounty$/i, '')
            .replace(/ Parish$/i, '')
            .trim();
    }

    if (cleanVillage) return `${cleanVillage}, ${countryPart}`;
    return countryPart;
}

function buildHierarchicalQuery(site: Site, country: string): string {
    const ancestors = Object.values(site.locationHierarchy).filter(
        value => value !== site.name,
    );
    return [site.name, ancestors[0], country].filter(Boolean).join(', ');
}

/** Most specific first, e.g. "Bukatube, Mayuge, Uganda". */
export function buildSiteLocationQuery(site: Site, country: string): string {
    return isLegacySite(site)
        ? buildLegacyQuery(site, country)
        : buildHierarchicalQuery(site, country);
}

/** "A, B, C" → ["A, B, C", "B, C", "C"]: broaden until something matches. */
export function fallbackQueries(query: string): string[] {
    const parts = query
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    return parts.map((_, index) => parts.slice(index).join(', '));
}
