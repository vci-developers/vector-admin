import { DefaultExcludeContext } from '@/features/dashboard/components/dashboard-provider';
import { RANGE_PRESETS } from '@/features/dashboard/utils/resolve-reporting-range';
import { MAP_LAYERS } from '@/features/dashboard/components/map-constants';
import { sessionTypeSchema } from '@/api/session/validation/session-schema';
import {
    parseAsArrayOf,
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from 'nuqs';
import { use, useMemo } from 'react';

const dashboardFilterParsers = {
    range: parseAsStringLiteral(RANGE_PRESETS).withDefault('last-month'),
    from: parseAsString,
    to: parseAsString,
    // Default set per viewer: see useDashboardFilters.
    exclude: parseAsArrayOf(parseAsInteger).withDefault([]),
    types: parseAsArrayOf(
        parseAsStringLiteral(sessionTypeSchema.options),
    ).withDefault(['SURVEILLANCE']),
    // Include the Test Site ("Other"), the testing and training catch-all
    testSites: parseAsBoolean.withDefault(false),
    // Program whose Session panel is open
    sessions: parseAsInteger,
    layers: parseAsArrayOf(parseAsStringLiteral(MAP_LAYERS)).withDefault([
        ...MAP_LAYERS,
    ]),
};

/**
 * The page's filters, kept in the URL. A missing `exclude` means the viewer's
 * default selection (DashboardProvider): Uganda only for a
 * Stakeholder, everything but the Hidden-by-Default list for a Developer.
 */
export function useDashboardFilters() {
    const defaultExclude = use(DefaultExcludeContext);
    const parsers = useMemo(
        () => ({
            ...dashboardFilterParsers,
            exclude: dashboardFilterParsers.exclude.withDefault(defaultExclude),
        }),
        [defaultExclude],
    );
    return useQueryStates(parsers);
}
