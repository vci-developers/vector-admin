import type { MonthKey } from './month-key';

export const RANGE_PRESETS = [
    '3m',
    '6m',
    '12m',
    'ytd',
    'all',
    'custom',
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

/** `from` is undefined for All time: the server starts at the earliest data. */
export type ResolvedRange = { from?: MonthKey; to: MonthKey };

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string | null): value is MonthKey {
    return value !== null && MONTH_KEY_PATTERN.test(value);
}

function monthKey(year: number, monthIndex: number): MonthKey {
    const date = new Date(Date.UTC(year, monthIndex, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Presets are relative to `now`, so a bookmarked preset tracks the current month.
export function resolveReportingRange(
    preset: RangePreset,
    custom: { from: string | null; to: string | null },
    now: Date,
): ResolvedRange {
    const year = now.getFullYear();
    const month = now.getMonth();
    const to = monthKey(year, month);
    const lastMonths = (count: number) => ({
        from: monthKey(year, month - count + 1),
        to,
    });

    switch (preset) {
        case '3m':
            return lastMonths(3);
        case '6m':
            return lastMonths(6);
        case 'ytd':
            return { from: monthKey(year, 0), to };
        case 'all':
            return { to };
        case 'custom':
            if (
                isMonthKey(custom.from) &&
                isMonthKey(custom.to) &&
                custom.from <= custom.to
            ) {
                return { from: custom.from, to: custom.to };
            }
            return lastMonths(12);
        case '12m':
            return lastMonths(12);
    }
}

// Defaults to the last complete month; always lands inside the range.
export function resolveSelectedMonth(
    month: string | null,
    range: ResolvedRange,
    now: Date,
): MonthKey {
    const lastComplete = monthKey(now.getFullYear(), now.getMonth() - 1);
    const wanted = isMonthKey(month) ? month : lastComplete;
    if (wanted > range.to) return range.to;
    if (range.from && wanted < range.from) return range.from;
    return wanted;
}
