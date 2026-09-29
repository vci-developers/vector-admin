import {
    MAPPED_DEVICE_STATUSES,
    NOT_RECORDED,
    type MappedDeviceStatus,
    type SpecimenFilter,
} from '@/features/dashboard/utils/filter-map-points';
import {
    parseAsArrayOf,
    parseAsBoolean,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from 'nuqs';
import { useMemo } from 'react';

// By default the map shows identified mosquitoes and Active devices only:
// unidentified species, non-mosquitoes, empty traps and Inactive devices are
// hidden until asked for. Unrecorded sex and abdomen status stay shown: males
// never have an abdomen status, so hiding it would hide every male.
export const MAP_FILTER_DEFAULTS = {
    hideSpecies: [NOT_RECORDED],
    hideSex: [] as string[],
    hideAbdomen: [] as string[],
    nonMosquito: false,
    zeroCatch: false,
    deviceStatus: ['ACTIVE'] as MappedDeviceStatus[],
};

// Map-only filters; the KPI tiles and summary table ignore them.
const mapFilterParsers = {
    hideSpecies: parseAsArrayOf(parseAsString).withDefault(
        MAP_FILTER_DEFAULTS.hideSpecies,
    ),
    hideSex: parseAsArrayOf(parseAsString).withDefault(
        MAP_FILTER_DEFAULTS.hideSex,
    ),
    hideAbdomen: parseAsArrayOf(parseAsString).withDefault(
        MAP_FILTER_DEFAULTS.hideAbdomen,
    ),
    nonMosquito: parseAsBoolean.withDefault(MAP_FILTER_DEFAULTS.nonMosquito),
    zeroCatch: parseAsBoolean.withDefault(MAP_FILTER_DEFAULTS.zeroCatch),
    deviceStatus: parseAsArrayOf(
        parseAsStringLiteral(MAPPED_DEVICE_STATUSES),
    ).withDefault(MAP_FILTER_DEFAULTS.deviceStatus),
};

export function useMapFilters() {
    const [filters, setFilters] = useQueryStates(mapFilterParsers);
    const specimenFilter = useMemo<SpecimenFilter>(
        () => ({
            hiddenSpecies: filters.hideSpecies,
            hiddenSex: filters.hideSex,
            hiddenAbdomen: filters.hideAbdomen,
            showNonMosquito: filters.nonMosquito,
            showZeroCatch: filters.zeroCatch,
        }),
        [filters],
    );
    return { filters, specimenFilter, setFilters };
}
