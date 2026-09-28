import { RANGE_PRESETS } from '@/features/dashboard/utils/resolve-reporting-range';
import {
    parseAsArrayOf,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
    useQueryStates,
} from 'nuqs';

// Prod program 5 (Johns Hopkins University) may be internal test data. Test
// program ids start at 7, so this is a no-op there.
export const HIDDEN_BY_DEFAULT_PROGRAM_IDS = [5];

const dashboardFilterParsers = {
    range: parseAsStringLiteral(RANGE_PRESETS).withDefault('12m'),
    from: parseAsString,
    to: parseAsString,
    month: parseAsString,
    // Program whose Session panel is open
    sessions: parseAsInteger,
    mapPeriod: parseAsStringLiteral(['range', 'month'] as const).withDefault(
        'range',
    ),
    layer: parseAsStringLiteral(['specimens', 'devices'] as const).withDefault(
        'specimens',
    ),
    exclude: parseAsArrayOf(parseAsInteger).withDefault(
        HIDDEN_BY_DEFAULT_PROGRAM_IDS,
    ),
};

export function useDashboardFilters() {
    return useQueryStates(dashboardFilterParsers);
}
