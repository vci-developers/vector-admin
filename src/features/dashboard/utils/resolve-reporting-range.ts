import type { MonthKey } from './month-key';

export const RANGE_PRESETS = [
    'this-month',
    'last-month',
    '3m',
    '6m',
    '12m',
    'ytd',
    'all',
    'month',
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
// Rolling presets end at the last complete month so they never compare a
// partial month with whole ones; This month, All time, a chosen month and
// custom ranges may include the current month, which is then in progress.
// A chosen month (`month`) is kept in `to`.
export function resolveReportingRange(
    preset: RangePreset,
    custom: { from: string | null; to: string | null },
    now: Date,
): ResolvedRange {
    const year = now.getFullYear();
    const month = now.getMonth();
    const current = monthKey(year, month);
    const previous = monthKey(year, month - 1);
    const lastMonths = (count: number) => ({
        from: monthKey(year, month - count),
        to: previous,
    });
    const lastMonth = () => ({ from: previous, to: previous });

    switch (preset) {
        case 'this-month':
            return { from: current, to: current };
        case 'last-month':
            return lastMonth();
        case '3m':
            return lastMonths(3);
        case '6m':
            return lastMonths(6);
        case 'ytd':
            // In January no month of the year is complete yet.
            return month === 0
                ? { from: current, to: current }
                : { from: monthKey(year, 0), to: previous };
        case 'all':
            return { to: current };
        case 'month':
            return isMonthKey(custom.to)
                ? { from: custom.to, to: custom.to }
                : lastMonth();
        case 'custom':
            if (
                isMonthKey(custom.from) &&
                isMonthKey(custom.to) &&
                custom.from <= custom.to
            ) {
                return { from: custom.from, to: custom.to };
            }
            return lastMonth();
        case '12m':
            return lastMonths(12);
    }
}

/** A period is in progress when it includes the current month. */
export function isInProgress(to: MonthKey, currentMonth: MonthKey): boolean {
    return to >= currentMonth;
}
