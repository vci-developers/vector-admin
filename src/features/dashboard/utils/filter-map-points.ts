import type { DeviceStatus } from './classify-devices';
import type { SpecimenGroup } from './build-specimen-points';

/** The reviewed species for anything that is not a mosquito. */
export const NON_MOSQUITO = 'Non-Mosquito';
/** Filter value for a specimen with no species, sex or abdomen status. */
export const NOT_RECORDED = 'none';
/**
 * A field the specimen can never have, as VectorCam treats it: a male's
 * abdomen status, a non-mosquito's sex and abdomen status. Never filtered on,
 * so these specimens' visibility doesn't hang on it.
 */
export const NOT_APPLICABLE = 'N/A';
const MALE = 'Male';

export type SpecimenField = 'species' | 'sex' | 'abdomen';

/** A group's value for one field: the value, NOT_RECORDED or NOT_APPLICABLE. */
export function fieldValue(group: SpecimenGroup, field: SpecimenField): string {
    if (field === 'species') return group.species ?? NOT_RECORDED;
    if (group.species === NON_MOSQUITO) return NOT_APPLICABLE;
    if (field === 'sex') return group.sex ?? NOT_RECORDED;
    if (group.sex === MALE) return NOT_APPLICABLE;
    return group.abdomenStatus ?? NOT_RECORDED;
}

/**
 * Hidden values are listed rather than shown ones, so a species or status
 * that first appears later is shown without anyone opting in.
 */
export type SpecimenFilter = {
    hiddenSpecies: string[];
    hiddenSex: string[];
    hiddenAbdomen: string[];
    showNonMosquito: boolean;
    showZeroCatch: boolean;
};

/** The filter that hid a specimen: the first one it fails, in panel order. */
export type HiddenReason =
    | { filter: 'nonMosquito' }
    | { filter: 'species' | 'sex' | 'abdomen'; value: string };

export type HiddenCount = { reason: HiddenReason; count: number };

function hiddenReason(
    group: SpecimenGroup,
    filter: SpecimenFilter,
): HiddenReason | null {
    const species = fieldValue(group, 'species');
    const sex = fieldValue(group, 'sex');
    const abdomen = fieldValue(group, 'abdomen');
    if (group.species === NON_MOSQUITO) {
        if (!filter.showNonMosquito) return { filter: 'nonMosquito' };
    } else if (filter.hiddenSpecies.includes(species)) {
        return { filter: 'species', value: species };
    }
    if (filter.hiddenSex.includes(sex)) return { filter: 'sex', value: sex };
    if (filter.hiddenAbdomen.includes(abdomen)) {
        return { filter: 'abdomen', value: abdomen };
    }
    return null;
}

const reasonKey = (reason: HiddenReason) =>
    reason.filter === 'nonMosquito'
        ? reason.filter
        : `${reason.filter}:${reason.value}`;

/** Merges hidden counts by reason, largest first. */
function mergeHidden(counts: HiddenCount[]): HiddenCount[] {
    const merged = new Map<string, HiddenCount>();
    for (const { reason, count } of counts) {
        const key = reasonKey(reason);
        const existing = merged.get(key);
        merged.set(key, { reason, count: (existing?.count ?? 0) + count });
    }
    return [...merged.values()].sort((a, b) => b.count - a.count);
}

/**
 * Keeps the Sessions with at least one matching specimen, keeping and counting
 * only those, plus zero-catch Sessions when shown, and records which filter
 * hid the rest. A Session whose specimens all fail the filter is dropped: it
 * is not an empty trap.
 */
export function filterSessions<
    Session extends { specimenCount: number; specimenGroups: SpecimenGroup[] },
>(
    sessions: Session[],
    filter: SpecimenFilter,
): (Session & { hiddenBy: HiddenCount[] })[] {
    return sessions.flatMap(session => {
        if (session.specimenCount === 0) {
            return filter.showZeroCatch ? [{ ...session, hiddenBy: [] }] : [];
        }
        const specimenGroups: SpecimenGroup[] = [];
        const hidden: HiddenCount[] = [];
        for (const group of session.specimenGroups) {
            const reason = hiddenReason(group, filter);
            if (reason) hidden.push({ reason, count: group.count });
            else specimenGroups.push(group);
        }
        const specimenCount = specimenGroups.reduce(
            (sum, group) => sum + group.count,
            0,
        );
        return specimenCount > 0
            ? [
                  {
                      ...session,
                      specimenCount,
                      specimenGroups,
                      hiddenBy: mergeHidden(hidden),
                  },
              ]
            : [];
    });
}

export type SpecimenFacets = {
    species: Map<string, number>;
    sex: Map<string, number>;
    abdomen: Map<string, number>;
    nonMosquito: number;
    zeroCatchSessions: number;
};

/** Every value in the data with its specimen count, before filtering. */
export function buildSpecimenFacets(
    sessions: { specimenCount: number; specimenGroups: SpecimenGroup[] }[],
): SpecimenFacets {
    const facets: SpecimenFacets = {
        species: new Map(),
        sex: new Map(),
        abdomen: new Map(),
        nonMosquito: 0,
        zeroCatchSessions: 0,
    };
    const add = (counts: Map<string, number>, key: string, count: number) =>
        counts.set(key, (counts.get(key) ?? 0) + count);
    for (const session of sessions) {
        if (session.specimenCount === 0) facets.zeroCatchSessions += 1;
        for (const group of session.specimenGroups) {
            if (group.species === NON_MOSQUITO)
                facets.nonMosquito += group.count;
            else add(facets.species, fieldValue(group, 'species'), group.count);
            // N/A is never a filter option.
            const sex = fieldValue(group, 'sex');
            if (sex !== NOT_APPLICABLE) add(facets.sex, sex, group.count);
            const abdomen = fieldValue(group, 'abdomen');
            if (abdomen !== NOT_APPLICABLE)
                add(facets.abdomen, abdomen, group.count);
        }
    }
    return facets;
}

/** The map draws Active devices only: those with Sessions in the period. */
export function activeDevices<Device extends { status: DeviceStatus }>(
    devices: Device[],
): Device[] {
    return devices.filter(device => device.status === 'ACTIVE');
}

export type SpecimenSummary = {
    sessions: number;
    specimens: number;
    /** Specimens in these Sessions that the map filters hide. */
    hiddenSpecimens: number;
    /** Which filters hid them, largest first. */
    hiddenBy: HiddenCount[];
    /** Each as [value, count], most common first; "none" (no value yet), then "N/A", last. */
    species: [string, number][];
    sex: [string, number][];
    abdomen: [string, number][];
};

// Missing values sort last, N/A after them.
const lastRank = (value: string) =>
    value === NOT_APPLICABLE ? 2 : value === NOT_RECORDED ? 1 : 0;

/** What a clicked point or cluster holds, over its (filtered) Sessions. */
export function summarizeSpecimens(
    sessions: {
        specimenCount: number;
        specimenGroups: SpecimenGroup[];
        hiddenBy?: HiddenCount[];
    }[],
): SpecimenSummary {
    const species = new Map<string, number>();
    const sex = new Map<string, number>();
    const abdomen = new Map<string, number>();
    const add = (counts: Map<string, number>, key: string, count: number) =>
        counts.set(key, (counts.get(key) ?? 0) + count);
    for (const session of sessions) {
        for (const group of session.specimenGroups) {
            add(species, fieldValue(group, 'species'), group.count);
            add(sex, fieldValue(group, 'sex'), group.count);
            // Males and non-mosquitoes have no abdomen status to count.
            const status = fieldValue(group, 'abdomen');
            if (status !== NOT_APPLICABLE) add(abdomen, status, group.count);
        }
    }
    const hiddenBy = mergeHidden(sessions.flatMap(s => s.hiddenBy ?? []));
    const sorted = (counts: Map<string, number>) =>
        [...counts].sort(
            ([a, countA], [b, countB]) =>
                lastRank(a) - lastRank(b) || countB - countA,
        );
    return {
        sessions: sessions.length,
        specimens: sessions.reduce((sum, s) => sum + s.specimenCount, 0),
        hiddenSpecimens: hiddenBy.reduce((sum, h) => sum + h.count, 0),
        hiddenBy,
        species: sorted(species),
        sex: sorted(sex),
        abdomen: sorted(abdomen),
    };
}
