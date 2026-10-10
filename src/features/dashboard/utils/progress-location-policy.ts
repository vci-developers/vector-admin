import type { Program } from '@/api/program/validation/program-schema';
import type {
    ProgressCoverageUnit,
    ProgressLocationCoverage,
} from '@/api/progress/validation/progress-schema';
import type { Site } from '@/api/site/validation/site-schema';

const normalize = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');

const clean = (value: string | null | undefined) => {
    const name = value?.trim().replace(/\s+/g, ' ');
    return name && name.toUpperCase() !== 'N/A' ? name : null;
};

function levelKey(level: string): string {
    const key = normalize(level).replace(/[^a-z0-9]/g, '');
    if (['house', 'household', 'housenumber'].includes(key)) return 'household';
    if (['village', 'villagename', 'townvillage'].includes(key))
        return 'community';
    if (['municipality', 'municipio'].includes(key)) return 'municipality';
    if (key === 'healthdistrict') return 'health-district';
    if (['healthcenter', 'healthcentre'].includes(key)) return 'health-centre';
    return key;
}

const rank: Record<string, number> = {
    country: 0,
    region: 1,
    district: 2,
    'health-district': 2,
    subcounty: 3,
    'health-centre': 3.5,
    parish: 4,
    community: 5,
    municipality: 5,
    sentinelsite: 6,
    household: 7,
    trap: 8,
};

const legacyLevels = (site: Site) =>
    [
        ['district', site.district],
        ['subcounty', site.subCounty],
        ['health-centre', site.healthCenter],
        ['parish', site.parish],
        ['community', site.villageName],
        ['household', site.houseNumber],
    ] as const;

function levelsOf(site: Site) {
    return Object.entries(site.locationHierarchy).flatMap(([level, value]) => {
        const name = clean(value);
        return name ? [{ level: levelKey(level), name }] : [];
    });
}

function hasLevel(
    site: Site,
    unit: Exclude<ProgressCoverageUnit, 'collection-site'>,
) {
    return (
        levelsOf(site).some(({ level }) => level === unit) ||
        legacyLevels(site).some(
            ([level, value]) => level === unit && clean(value),
        )
    );
}

/** Reviewed against the approved API site metadata on 2026-10-10. */
const reviewedPolicies = new Map<
    number,
    { country: string; unit: ProgressCoverageUnit }
>([
    [1, { country: 'uganda', unit: 'household' }],
    [2, { country: 'colombia', unit: 'municipality' }],
    [3, { country: 'ghana', unit: 'household' }],
    [4, { country: 'kenya', unit: 'household' }],
    [6, { country: 'cameroon', unit: 'health-district' }],
]);

/** Resolve one unit for the entire program, including quiet reporting periods. */
export function progressLocationUnit(
    program: Program,
    sites: readonly Site[] = [],
): ProgressCoverageUnit {
    const reviewed = reviewedPolicies.get(program.programId);
    if (reviewed?.country === normalize(program.country)) return reviewed.unit;
    // New programs use the most specific recorded collection unit. Broader
    // parent records then remain incomplete, rather than becoming households.
    for (const unit of [
        'household',
        'municipality',
        'community',
        'health-district',
    ] as const)
        if (sites.some(site => hasLevel(site, unit))) return unit;
    return 'collection-site';
}

/**
 * A canonical leaf identity, never a parent inferred to be a household.
 * Partial hierarchies may supply missing ancestors/leaf through legacy fields.
 * Unknown descendant levels are discarded after the actual requested unit.
 */
export function progressLocationIdentity(
    program: Program,
    unit: ProgressCoverageUnit,
    site: Site | undefined,
): string | null {
    if (!site) return null;
    if (unit === 'collection-site')
        return `${program.programId}:${normalize(program.country)}:site:${site.siteId}`;
    // Colombia's legacy villageName field contains municipal collection
    // locations, while district contains their parent department.
    const hierarchy = levelsOf(site).map(({ level, name }) => ({
        level:
            unit === 'municipality'
                ? level === 'community'
                    ? 'municipality'
                    : level === 'department' || level === 'departamento'
                      ? 'district'
                      : level
                : level,
        name,
    }));
    const targetIndex = hierarchy.findIndex(({ level }) => level === unit);
    const cutoff = rank[unit];
    const identity = new Map<string, string>();
    for (const [index, { level, name }] of hierarchy.entries()) {
        const levelRank = rank[level];
        // A District below a Health District is a descendant, even though
        // these two administrative names otherwise share the same broad rank.
        if (
            unit === 'health-district' &&
            level === 'district' &&
            targetIndex >= 0 &&
            index > targetIndex
        )
            continue;
        if (
            levelRank === undefined
                ? targetIndex < 0 || index > targetIndex
                : levelRank > cutoff
        )
            continue;
        const normalizedName = normalize(
            level === 'district' || level === 'health-district'
                ? name.replace(/\s+(?:health\s+)?district$/i, '')
                : name,
        );
        if (identity.has(level) && identity.get(level) !== normalizedName)
            return null;
        identity.set(level, normalizedName);
    }
    for (const [legacyLevel, value] of legacyLevels(site)) {
        const level =
            unit === 'municipality' && legacyLevel === 'community'
                ? 'municipality'
                : legacyLevel;
        const name = clean(value);
        if (unit === 'health-district' && level === 'district') continue;
        if (name && rank[level] <= cutoff && !identity.has(level))
            identity.set(
                level,
                normalize(
                    level === 'district'
                        ? name.replace(/\s+district$/i, '')
                        : name,
                ),
            );
    }
    if (!identity.has(unit)) return null;
    // Household/community names alone are not globally unique. Retain their
    // district context; a Health District itself provides that context.
    if (
        unit !== 'health-district' &&
        !identity.has('district') &&
        !identity.has('health-district')
    )
        return null;
    const path = [...identity]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([level, name]) => [level, name]);
    return JSON.stringify([
        program.programId,
        normalize(program.country),
        unit,
        path,
    ]);
}

/** Combine disjoint district/node coverage while preserving each program's unit. */
export function mergeLocationCoverage(
    groups: readonly ProgressLocationCoverage[],
): ProgressLocationCoverage[] {
    const merged = new Map<string, ProgressLocationCoverage>();
    for (const group of groups) {
        const key = `${group.programId}:${group.unit}`;
        const current = merged.get(key);
        merged.set(key, {
            ...group,
            count: !current
                ? group.count
                : current.count === null || group.count === null
                  ? null
                  : current.count + group.count,
        });
    }
    return [...merged.values()].sort(
        (a, b) => a.programId - b.programId || a.unit.localeCompare(b.unit),
    );
}

/** A mixed or incomplete unit total has no meaningful single numeric value. */
export function totalReportingLocations(
    groups: readonly ProgressLocationCoverage[],
): number | null {
    if (
        groups.length === 0 ||
        groups.some(group => group.count === null) ||
        new Set(groups.map(group => group.unit)).size !== 1
    )
        return null;
    return groups.reduce((total, group) => total + group.count!, 0);
}
