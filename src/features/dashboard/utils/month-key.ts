import type { CollectionCycle } from '@/api/collection-cycle/validation/collection-cycle-schema';

/** A Reporting Month as `YYYY-MM`. */
export type MonthKey = string;

const formatters = new Map<string, Intl.DateTimeFormat>();

export function monthKeyOf(timestamp: number, timeZone: string): MonthKey {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
        });
        formatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(timestamp);
    const part = (type: 'year' | 'month') =>
        parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}`;
}

export function monthsInRange(from: MonthKey, to: MonthKey): MonthKey[] {
    const months: MonthKey[] = [];
    let [year, month] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    while (year < toYear || (year === toYear && month <= toMonth)) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
        month = month === 12 ? 1 : month + 1;
        if (month === 1) year += 1;
    }
    return months;
}

function isValidTimeZone(timeZone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone });
        return true;
    } catch {
        return false;
    }
}

export function programTimeZone(cycles: CollectionCycle[]): string {
    const latest = cycles.reduce<CollectionCycle | undefined>(
        (best, cycle) =>
            cycle.timezone && (!best || cycle.startDate > best.startDate)
                ? cycle
                : best,
        undefined,
    );
    return latest?.timezone && isValidTimeZone(latest.timezone)
        ? latest.timezone
        : 'UTC';
}
