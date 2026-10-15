import type { ProgressSnapshot } from '@/api/admin/load-progress-snapshot';
import type { Program } from '@/api/program/validation/program-schema';
import type {
    ProgressDistrict,
    ProgressCoverageUnit,
    ProgressLocationCoverage,
    ProgressMonth,
    ProgressProgramScans,
    ProgressSentinelSites,
    ProgressSpecies,
    ProgressStephensi,
} from '@/api/progress/validation/progress-schema';
import type { Site } from '@/api/site/validation/site-schema';
import { monthKeyOf, monthsInRange, programTimeZone } from './month-key';
import type { ResolvedRange } from './resolve-reporting-range';
import { countSentinelSites } from './count-sentinel-sites';
import { siteLocationPath } from './site-location-path';
import { isStephensi } from './stephensi-totals';
import {
    mergeLocationCoverage,
    progressLocationIdentity,
    progressLocationUnit,
    totalReportingLocations,
} from './progress-location-policy';

export type ProgressProgramData = {
    program: Program;
    snapshot: ProgressSnapshot;
};
type Position = NonNullable<ProgressDistrict['position']>;

const UNKNOWN_DISTRICT = 'District not recorded';
const UNKNOWN_KEY = 'unknown';

const normalize = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ');

function cleanName(value: string | null | undefined): string | null {
    const name = value?.trim().replace(/\s+/g, ' ');
    return name && name.toUpperCase() !== 'N/A' ? name : null;
}

/** Use the program's reporting area without promoting Region-only parent nodes. */
export function progressDistrictName(
    site: Site | undefined,
    unit?: ProgressCoverageUnit,
): string | null {
    if (!site) return null;
    if (unit === 'municipality') {
        const department = Object.entries(site.locationHierarchy).find(
            ([level]) =>
                ['department', 'departamento'].includes(normalize(level)),
        )?.[1];
        if (cleanName(department)) return cleanName(department);
    }
    const district = Object.entries(site.locationHierarchy).find(
        ([level]) => normalize(level) === 'district',
    )?.[1];
    const healthDistrict = Object.entries(site.locationHierarchy).find(
        ([level]) =>
            normalize(level).replace(/[^a-z]/g, '') === 'healthdistrict',
    )?.[1];
    if (unit === 'health-district')
        return (
            cleanName(healthDistrict)?.replace(
                /\s+(?:health\s+)?district$/i,
                '',
            ) ?? null
        );
    return (
        (
            cleanName(district) ??
            cleanName(site.district) ??
            cleanName(healthDistrict)
        )?.replace(/\s+(?:health\s+)?district$/i, '') ?? null
    );
}

export function progressDistrictKey(
    country: string,
    district: string | null,
    programId: number,
): string {
    return district === null
        ? `${normalize(country)}:${programId}:${UNKNOWN_KEY}`
        : `${normalize(country)}:${normalize(district.replace(/\s+district$/i, ''))}`;
}

function isTestSite(site: Site | undefined): boolean {
    return (
        normalize(progressDistrictName(site) ?? '') === 'other' ||
        normalize(site ? (siteLocationPath(site)[0]?.name ?? '') : '') ===
            'other'
    );
}

const emptyMonths = (months: string[]): ProgressMonth[] =>
    months.map(month => ({ month, uniqueScans: 0 }));

type CoverageAccumulator = {
    programId: number;
    unit: ProgressCoverageUnit;
    locations: Set<string>;
    incomplete: boolean;
};

function coverageOf(group: CoverageAccumulator): ProgressLocationCoverage {
    return {
        programId: group.programId,
        unit: group.unit,
        count: group.incomplete ? null : group.locations.size,
    };
}

// Surveillance, calibration and training; the API's CALIBRATION type is not.
const COUNTED_SESSION_TYPES = new Set([
    'SURVEILLANCE',
    'DATA_COLLECTION',
    'PRACTICE',
]);

type SpeciesCounts = Map<string | null, number>;

function addSpecies(into: SpeciesCounts, from: SpeciesCounts | undefined) {
    for (const [name, count] of from ?? [])
        into.set(name, (into.get(name) ?? 0) + count);
}

/** Most specimens first; specimens without a species last. */
function speciesListOf(counts: SpeciesCounts): ProgressSpecies[] {
    return [...counts]
        .map(([name, specimens]) => ({ name, specimens }))
        .sort(
            (a, b) =>
                Number(a.name === null) - Number(b.name === null) ||
                b.specimens - a.specimens ||
                (a.name ?? '').localeCompare(b.name ?? ''),
        );
}

type StephensiAccumulator = Omit<ProgressStephensi, 'districts'> & {
    districts: Map<
        string,
        Omit<ProgressStephensi['districts'][number], 'monthly'> & {
            months: Map<string, number>;
        }
    >;
};

type SiteVisits = Parameters<typeof countSentinelSites>[0];

type DistrictAccumulator = ProgressDistrict & {
    speciesCounts: SpeciesCounts;
    visits: Map<number, SiteVisits>;
    coverage: Map<number, CoverageAccumulator>;
    scans: Map<number, number>;
    specimens: Map<number, number>;
    months: Map<string, ProgressMonth>;
};

/**
 * All figures come from surveillance, calibration and training sessions,
 * including zero catches and sessions without GPS. Scan, location, district and month totals therefore
 * reconcile regardless of whether a district can be drawn on the map.
 */
export function prepareProgressData(
    programs: ProgressProgramData[],
    range: ResolvedRange,
) {
    const prepared = programs.map(({ program, snapshot }) => {
        const sites = new Map(snapshot.sites.map(site => [site.siteId, site]));
        const timeZone = programTimeZone(snapshot.collectionCycles);
        const sessions = [
            ...new Map(
                snapshot.sessions.map(session => [session.sessionId, session]),
            ).values(),
        ]
            .filter(
                session =>
                    COUNTED_SESSION_TYPES.has(session.type) &&
                    !isTestSite(sites.get(session.siteId)),
            )
            .map(session => ({
                ...session,
                // Stakeholders count a Session in the month it was submitted.
                month: monthKeyOf(session.submittedAt, timeZone),
            }));
        const scansBySession = new Map<number, number>();
        const specimensBySession = new Map<number, number>();
        const speciesBySession = new Map<number, SpeciesCounts>();
        const eligibleSessions = new Set(
            sessions
                .filter(
                    session =>
                        session.month <= range.to &&
                        (!range.from || session.month >= range.from),
                )
                .map(session => session.sessionId),
        );
        for (const counts of snapshot.specimenCounts) {
            if (!eligibleSessions.has(counts.sessionId)) continue;
            scansBySession.set(counts.sessionId, counts.imageCount);
            specimensBySession.set(counts.sessionId, counts.specimenCount);
            // Groups split by sex and abdomen too; only species is reported.
            const species: SpeciesCounts = new Map();
            for (const group of counts.groups) {
                const name = group.species?.trim() || null;
                species.set(name, (species.get(name) ?? 0) + group.count);
            }
            speciesBySession.set(counts.sessionId, species);
        }
        return {
            program,
            snapshot,
            sites,
            sessions,
            scansBySession,
            specimensBySession,
            speciesBySession,
        };
    });

    const earliest = prepared
        .flatMap(({ sessions }) => sessions.map(session => session.month))
        .filter(month => month <= range.to)
        .reduce<string | undefined>(
            (first, month) => (!first || month < first ? month : first),
            undefined,
        );
    const from = range.from ?? earliest ?? range.to;
    return {
        from,
        to: range.to,
        programs: prepared.map(programData => ({
            ...programData,
            sessions: programData.sessions.filter(
                session => session.month >= from && session.month <= range.to,
            ),
        })),
    };
}

export function buildProgress(
    programs: ProgressProgramData[],
    range: ResolvedRange,
    anchors: Map<string, Position> = new Map(),
) {
    const {
        from,
        to,
        programs: prepared,
    } = prepareProgressData(programs, range);
    const months = monthsInRange(from, to);
    const monthly = emptyMonths(months);
    const monthTotals = new Map(monthly.map(row => [row.month, row]));
    const districts = new Map<string, DistrictAccumulator>();
    const coverage: CoverageAccumulator[] = [];
    const scansByProgram: ProgressProgramScans[] = [];
    const sentinelSitesByProgram: ProgressSentinelSites[] = [];
    let uniqueScans = 0;
    let uniqueSpecimens = 0;
    const speciesCounts: SpeciesCounts = new Map();
    const stephensi = new Map<string, StephensiAccumulator>();
    let latestReceivedAt: number | null = null;

    for (const {
        program,
        snapshot,
        sites,
        sessions,
        scansBySession,
        specimensBySession,
        speciesBySession,
    } of prepared) {
        const unit = progressLocationUnit(program, snapshot.sites);
        const programCoverage: CoverageAccumulator = {
            programId: program.programId,
            unit,
            locations: new Set(),
            incomplete: false,
        };
        coverage.push(programCoverage);
        const programScans = {
            programId: program.programId,
            scans: 0,
            specimens: 0,
        };
        scansByProgram.push(programScans);
        const programVisits: SiteVisits = [];
        for (const session of sessions) {
            const site = sites.get(session.siteId);
            const districtName = progressDistrictName(site, unit);
            const key = progressDistrictKey(
                program.country,
                districtName,
                program.programId,
            );
            let district = districts.get(key);
            if (!district) {
                const monthly = emptyMonths(months);
                district = {
                    key,
                    programId: program.programId,
                    programIds: [program.programId],
                    country: program.country,
                    name: districtName ?? UNKNOWN_DISTRICT,
                    coverageByProgram: [],
                    scansByProgram: [],
                    sentinelSitesByProgram: [],
                    visits: new Map(),
                    reportingLocations: 0,
                    uniqueScans: 0,
                    uniqueSpecimens: 0,
                    species: [],
                    speciesCounts: new Map(),
                    monthly,
                    position:
                        districtName === null
                            ? null
                            : (anchors.get(key) ?? null),
                    latestReceivedAt: null,
                    coverage: new Map(),
                    scans: new Map(),
                    specimens: new Map(),
                    months: new Map(monthly.map(row => [row.month, row])),
                };
                districts.set(key, district);
            }
            if (!district.programIds.includes(program.programId)) {
                district.programIds.push(program.programId);
            }

            const districtCoverage = district.coverage.get(
                program.programId,
            ) ?? {
                programId: program.programId,
                unit,
                locations: new Set<string>(),
                incomplete: false,
            };
            district.coverage.set(program.programId, districtCoverage);
            const location = progressLocationIdentity(program, unit, site);
            if (location === null) {
                programCoverage.incomplete = true;
                districtCoverage.incomplete = true;
            } else {
                districtCoverage.locations.add(location);
                programCoverage.locations.add(location);
            }
            const count = scansBySession.get(session.sessionId) ?? 0;
            programScans.scans += count;
            if (site) {
                const visit = {
                    siteId: session.siteId,
                    location: siteLocationPath(site),
                };
                programVisits.push(visit);
                const districtVisits =
                    district.visits.get(program.programId) ?? [];
                district.visits.set(program.programId, districtVisits);
                districtVisits.push(visit);
            }
            district.scans.set(
                program.programId,
                (district.scans.get(program.programId) ?? 0) + count,
            );
            district.uniqueScans += count;
            district.months.get(session.month)!.uniqueScans += count;
            monthTotals.get(session.month)!.uniqueScans += count;
            uniqueScans += count;
            const specimens = specimensBySession.get(session.sessionId) ?? 0;
            programScans.specimens += specimens;
            district.specimens.set(
                program.programId,
                (district.specimens.get(program.programId) ?? 0) + specimens,
            );
            district.uniqueSpecimens += specimens;
            uniqueSpecimens += specimens;
            addSpecies(
                district.speciesCounts,
                speciesBySession.get(session.sessionId),
            );
            addSpecies(speciesCounts, speciesBySession.get(session.sessionId));
            for (const [name, specimens] of speciesBySession.get(
                session.sessionId,
            ) ?? []) {
                if (!name || !isStephensi(name)) continue;
                const id = `${program.programId}:${name}`;
                const row = stephensi.get(id) ?? {
                    programId: program.programId,
                    species: name,
                    specimens: 0,
                    latestMonth: session.month,
                    districts: new Map(),
                };
                stephensi.set(id, row);
                row.specimens += specimens;
                if (session.month > row.latestMonth)
                    row.latestMonth = session.month;
                const area = row.districts.get(district.key) ?? {
                    key: district.key,
                    name: district.name,
                    specimens: 0,
                    months: new Map(),
                };
                row.districts.set(district.key, area);
                area.specimens += specimens;
                area.months.set(
                    session.month,
                    (area.months.get(session.month) ?? 0) + specimens,
                );
            }
            district.latestReceivedAt = Math.max(
                district.latestReceivedAt ?? session.submittedAt,
                session.submittedAt,
            );
            latestReceivedAt = Math.max(
                latestReceivedAt ?? session.submittedAt,
                session.submittedAt,
            );
        }
        sentinelSitesByProgram.push({
            programId: program.programId,
            count: countSentinelSites(programVisits).sentinelSites,
        });
    }

    const rows: ProgressDistrict[] = [...districts.values()].map(district => {
        const coverageByProgram = mergeLocationCoverage(
            [...district.coverage.values()].map(coverageOf),
        );
        return {
            key: district.key,
            programId: Math.min(...district.programIds),
            programIds: district.programIds.sort((a, b) => a - b),
            country: district.country,
            name: district.name,
            uniqueScans: district.uniqueScans,
            uniqueSpecimens: district.uniqueSpecimens,
            species: speciesListOf(district.speciesCounts),
            monthly: district.monthly,
            latestReceivedAt: district.latestReceivedAt,
            coverageByProgram,
            scansByProgram: [...district.scans]
                .map(([programId, scans]) => ({
                    programId,
                    scans,
                    specimens: district.specimens.get(programId) ?? 0,
                }))
                .sort((a, b) => a.programId - b.programId),
            sentinelSitesByProgram: [...district.visits]
                .map(([programId, visits]) => ({
                    programId,
                    count: countSentinelSites(visits).sentinelSites,
                }))
                .sort((a, b) => a.programId - b.programId),
            reportingLocations: totalReportingLocations(coverageByProgram),
            // Anchors resolve the collection site's named reporting area.
            // Session GPS describes where the session was conducted.
            position: district.position,
        };
    });
    rows.sort(
        (a, b) =>
            a.country.localeCompare(b.country) ||
            a.name.localeCompare(b.name) ||
            a.programId - b.programId,
    );
    const fetchedAt = programs.map(({ snapshot }) => snapshot.fetchedAt);
    const coverageByProgram = mergeLocationCoverage(coverage.map(coverageOf));

    return {
        from,
        to,
        coverageByProgram,
        scansByProgram: scansByProgram.sort(
            (a, b) => a.programId - b.programId,
        ),
        sentinelSitesByProgram: sentinelSitesByProgram.sort(
            (a, b) => a.programId - b.programId,
        ),
        reportingLocations: totalReportingLocations(coverageByProgram),
        uniqueScans: programs.length ? uniqueScans : null,
        uniqueSpecimens: programs.length ? uniqueSpecimens : null,
        species: speciesListOf(speciesCounts),
        stephensi: [...stephensi.values()]
            .map(row => ({
                ...row,
                districts: [...row.districts.values()]
                    .map(({ months, ...area }) => ({
                        ...area,
                        monthly: [...months]
                            .map(([month, specimens]) => ({ month, specimens }))
                            .sort((a, b) => a.month.localeCompare(b.month)),
                    }))
                    .sort((a, b) => b.specimens - a.specimens),
            }))
            .sort(
                (a, b) =>
                    a.programId - b.programId ||
                    a.species.localeCompare(b.species),
            ),
        districts: rows,
        monthly,
        lastUpdatedAt: fetchedAt.length ? Math.min(...fetchedAt) : null,
        latestReceivedAt,
    };
}
