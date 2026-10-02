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

// Prod program 5 (Johns Hopkins University) may be internal test data. Test
// program ids start at 7, so this is a no-op there.
export const HIDDEN_BY_DEFAULT_PROGRAM_IDS = [5];

const dashboardFilterParsers = {
    range: parseAsStringLiteral(RANGE_PRESETS).withDefault('last-month'),
    from: parseAsString,
    to: parseAsString,
    exclude: parseAsArrayOf(parseAsInteger).withDefault(
        HIDDEN_BY_DEFAULT_PROGRAM_IDS,
    ),
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

export function useDashboardFilters() {
    return useQueryStates(dashboardFilterParsers);
}
