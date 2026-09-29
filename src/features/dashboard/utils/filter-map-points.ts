import type { DeviceStatus } from './classify-devices';
import type { SpecimenGroup } from './build-specimen-points';

/** The reviewed species for anything that is not a mosquito. */
export const NON_MOSQUITO = 'Non-Mosquito';
/** Filter value for a specimen with no species, sex or abdomen status. */
export const NOT_RECORDED = 'none';

export const MAPPED_DEVICE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type MappedDeviceStatus = (typeof MAPPED_DEVICE_STATUSES)[number];

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

const valueOf = (value: string | null) => value ?? NOT_RECORDED;

/** The filter that hid a specimen: the first one it fails, in panel order. */
export type HiddenReason =
    | { filter: 'nonMosquito' }
    | { filter: 'species' | 'sex' | 'abdomen'; value: string };

export type HiddenCount = { reason: HiddenReason; count: number };

function hiddenReason(
    group: SpecimenGroup,
    filter: SpecimenFilter,
): HiddenReason | null {
    const species = valueOf(group.species);
    const sex = valueOf(group.sex);
    const abdomen = valueOf(group.abdomenStatus);
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
            else add(facets.species, valueOf(group.species), group.count);
            add(facets.sex, valueOf(group.sex), group.count);
            add(facets.abdomen, valueOf(group.abdomenStatus), group.count);
        }
    }
    return facets;
}

export function filterDevices<Device extends { status: DeviceStatus }>(
    devices: Device[],
    statuses: readonly MappedDeviceStatus[],
): Device[] {
    return devices.filter(device =>
        (statuses as readonly DeviceStatus[]).includes(device.status),
    );
}

export type SpecimenSummary = {
    sessions: number;
    specimens: number;
    /** Specimens in these Sessions that the map filters hide. */
    hiddenSpecimens: number;
    /** Which filters hid them, largest first. */
    hiddenBy: HiddenCount[];
    /** Each as [value, count], most common first; "none" is not recorded. */
    species: [string, number][];
    sex: [string, number][];
    abdomen: [string, number][];
};

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
            add(species, valueOf(group.species), group.count);
            add(sex, valueOf(group.sex), group.count);
            add(abdomen, valueOf(group.abdomenStatus), group.count);
        }
    }
    const hiddenBy = mergeHidden(sessions.flatMap(s => s.hiddenBy ?? []));
    const sorted = (counts: Map<string, number>) =>
        [...counts].sort(
            ([a, countA], [b, countB]) =>
                Number(a === NOT_RECORDED) - Number(b === NOT_RECORDED) ||
                countB - countA,
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
