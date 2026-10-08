import { addMonths, monthsInRange, type MonthKey } from './month-key';
import type { RangePreset } from './resolve-reporting-range';

export type MonthSpan = { from: MonthKey; to: MonthKey };

/**
 * A grid click: the month alone when nothing is anchored, else the span
 * between the anchor and it, whichever was clicked first.
 */
export function pickMonths(
    anchor: MonthKey | null,
    month: MonthKey,
): MonthSpan {
    if (!anchor) return { from: month, to: month };
    return anchor <= month
        ? { from: anchor, to: month }
        : { from: month, to: anchor };
}

/**
 * The span of the same length just before (-1) or after (1): a month steps a
 * month, a quarter steps a quarter. Never past `latest`; null when it would.
 */
export function shiftPeriod(
    span: MonthSpan,
    step: -1 | 1,
    latest: MonthKey,
): MonthSpan | null {
    const length = monthsInRange(span.from, span.to).length;
    const next = {
        from: addMonths(span.from, step * length),
        to: addMonths(span.to, step * length),
    };
    return next.to > latest ? null : next;
}

/** The URL filters for a span: one month is a Month, more is Custom. */
export function spanFilters(span: MonthSpan): {
    range: Extract<RangePreset, 'month' | 'custom'>;
    from: MonthKey | null;
    to: MonthKey;
} {
    return span.from === span.to
        ? { range: 'month', from: null, to: span.to }
        : { range: 'custom', from: span.from, to: span.to };
}
