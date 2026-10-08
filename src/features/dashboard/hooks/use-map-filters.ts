import {
    NOT_RECORDED,
    type SpecimenFilter,
} from '@/features/dashboard/utils/filter-map-points';
import {
    parseAsArrayOf,
    parseAsBoolean,
    parseAsString,
    useQueryStates,
} from 'nuqs';
import { useMemo } from 'react';

// By default the map shows identified mosquitoes and Active devices only:
// unidentified species, non-mosquitoes, empty traps and Inactive devices are
// hidden until asked for. Unrecorded sex and abdomen status stay shown: males
// never have an abdomen status, so hiding it would hide every male.
export const MAP_FILTER_DEFAULTS = {
    hideSpecies: [NOT_RECORDED],
    // Males and non-mosquitoes are N/A, never pending, so hiding pending
    // values hides no males.
    hideSex: [NOT_RECORDED],
    hideAbdomen: [NOT_RECORDED],
    nonMosquito: false,
    zeroCatch: false,
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
