import type { Site } from '@/api/site/validation/site-schema';
import { isLegacySite } from './site-location-query';

export type LocationLevel = { level: string; name: string };

// Legacy Sites have fixed fields, broadest first.
const LEGACY_LEVELS = [
    ['district', 'District'],
    ['subCounty', 'Sub-county'],
    ['healthCenter', 'Health Centre'],
    ['parish', 'Parish'],
    ['villageName', 'Village'],
    ['houseNumber', 'House'],
] as const;

/** The Site's place names, broadest first, skipping empty levels. */
export function siteLocationPath(site: Site): LocationLevel[] {
    const levels: [string, string | null | undefined][] = isLegacySite(site)
        ? LEGACY_LEVELS.map(([field, level]) => [level, site[field]])
        : Object.entries(site.locationHierarchy);
    // Legacy forms filled unused levels with "N/A"; they add no information.
    return levels.flatMap(([level, name]) => {
        const trimmed = name?.trim();
        return trimmed && trimmed.toUpperCase() !== 'N/A'
            ? [{ level, name: trimmed }]
            : [];
    });
}

/**
 * A Test Site: its top-level place is "Other", the catch-all for testing and
 * training (Uganda's Site 11 in prod).
 */
export function isTestSite(site: Site): boolean {
    return siteLocationPath(site)[0]?.name.toLowerCase() === 'other';
}

/** The Site sits under a real top-level place (a District in Uganda). */
export function isSiteUnderTopLevel(site: Site | undefined): boolean {
    return (
        site !== undefined &&
        siteLocationPath(site).length > 0 &&
        !isTestSite(site)
    );
}
