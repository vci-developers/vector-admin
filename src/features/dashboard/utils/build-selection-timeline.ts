import type { SpecimenGroup } from './build-specimen-points';
import { NOT_RECORDED } from './filter-map-points';
import { monthsInRange, type MonthKey } from './month-key';

export type TimelineDimension = 'species' | 'sex' | 'abdomen';

/** Named values that get their own colour; the rest fold into one grey series. */
export const TIMELINE_SLOTS = 6;
export const FOLDED_KEY = 'folded';

export type TimelineSeries =
    /** `slot` is the value's map-wide rank, so a colour follows the value. */
    | { kind: 'value'; key: string; value: string; slot: number }
    /** Everything past the slots, plus unrecorded values. */
    | {
          kind: 'folded';
          key: typeof FOLDED_KEY;
          hasNamed: boolean;
          hasNotRecorded: boolean;
      };

export type TimelineBucket = {
    key: string;
    /** UTC midnight at the start of the week, month or quarter. */
    start: number;
    total: number;
    counts: Record<string, number>;
};

export type TimelineGranularity = 'week' | 'month' | 'quarter';

export type SelectionTimeline = {
    granularity: TimelineGranularity;
    series: TimelineSeries[];
    buckets: TimelineBucket[];
    total: number;
};

type TimelineSession = {
    collectedAt: number;
    specimenGroups: SpecimenGroup[];
};

const DAY = 24 * 60 * 60 * 1000;

function valueOf(group: SpecimenGroup, dimension: TimelineDimension): string {
    const value =
        dimension === 'species'
            ? group.species
            : dimension === 'sex'
              ? group.sex
              : group.abdomenStatus;
    return value ?? NOT_RECORDED;
}

const monthKeyUtc = (time: number) => new Date(time).toISOString().slice(0, 7);

const quarterKey = (month: MonthKey) =>
    `${month.slice(0, 4)}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}`;

/** Enough bars to show a shape, few enough that each stays readable. */
function granularityFor(monthCount: number): TimelineGranularity {
    if (monthCount <= 3) return 'week';
    if (monthCount <= 24) return 'month';
    return 'quarter';
}

function bucketKey(time: number, granularity: TimelineGranularity): string {
    if (granularity === 'week') return String(weekStart(time));
    const month = monthKeyUtc(time);
    return granularity === 'month' ? month : quarterKey(month);
}

/** Monday 00:00 UTC of the week containing `time`. */
function weekStart(time: number): number {
    const day = new Date(time);
    const midnight = Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
    );
    return midnight - ((day.getUTCDay() + 6) % 7) * DAY;
}

function emptyBuckets(
    period: { from: MonthKey; to: MonthKey },
    granularity: TimelineGranularity,
): TimelineBucket[] {
    const months = monthsInRange(period.from, period.to);
    const monthStart = (month: MonthKey) => Date.parse(`${month}-01T00:00:00Z`);
    if (granularity === 'month') {
        return months.map(month => ({
            key: month,
            start: monthStart(month),
            total: 0,
            counts: {},
        }));
    }
    if (granularity === 'quarter') {
        const quarters = new Map<string, TimelineBucket>();
        for (const month of months) {
            const key = quarterKey(month);
            if (!quarters.has(key)) {
                quarters.set(key, {
                    key,
                    start: monthStart(month),
                    total: 0,
                    counts: {},
                });
            }
        }
        return [...quarters.values()];
    }
    const end = Date.parse(`${months[months.length - 1]}-01T00:00:00Z`);
    const periodEnd = Date.UTC(
        new Date(end).getUTCFullYear(),
        new Date(end).getUTCMonth() + 1,
        1,
    );
    const buckets: TimelineBucket[] = [];
    for (
        let start = weekStart(monthStart(months[0]));
        start < periodEnd;
        start += 7 * DAY
    ) {
        buckets.push({ key: String(start), start, total: 0, counts: {} });
    }
    return buckets;
}

/**
 * Specimens per week (periods of up to three months), month (up to two years)
 * or quarter, stacked by species, sex or abdomen status. Empty buckets before
 * the first specimen are dropped; later ones stay, so a quiet stretch shows as
 * a gap. Buckets are UTC; the chart is a shape, not the Reporting Month counts.
 *
 * @param ranking the dimension's values across the whole map, most common
 * first: the first {@link TIMELINE_SLOTS} named values keep their colour
 * whichever point is clicked.
 */
export function buildSelectionTimeline({
    sessions,
    period,
    dimension,
    ranking,
}: {
    sessions: TimelineSession[];
    period: { from: MonthKey; to: MonthKey };
    dimension: TimelineDimension;
    ranking: string[];
}): SelectionTimeline {
    const granularity = granularityFor(
        monthsInRange(period.from, period.to).length,
    );
    const buckets = emptyBuckets(period, granularity);
    const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
    const slots = new Map(
        ranking
            .filter(value => value !== NOT_RECORDED)
            .slice(0, TIMELINE_SLOTS)
            .map((value, index) => [value, index]),
    );
    const present = new Set<string>();
    let hasNamed = false;
    let hasNotRecorded = false;
    let total = 0;

    for (const session of sessions) {
        const bucket = byKey.get(bucketKey(session.collectedAt, granularity));
        if (!bucket) continue;
        for (const group of session.specimenGroups) {
            const value = valueOf(group, dimension);
            const key = slots.has(value) ? value : FOLDED_KEY;
            if (key === FOLDED_KEY) {
                if (value === NOT_RECORDED) hasNotRecorded = true;
                else hasNamed = true;
            }
            present.add(key);
            bucket.counts[key] = (bucket.counts[key] ?? 0) + group.count;
            bucket.total += group.count;
            total += group.count;
        }
    }

    const series: TimelineSeries[] = [...slots]
        .filter(([value]) => present.has(value))
        .map(([value, slot]) => ({
            kind: 'value' as const,
            key: value,
            value,
            slot,
        }));
    if (present.has(FOLDED_KEY)) {
        series.push({
            kind: 'folded',
            key: FOLDED_KEY,
            hasNamed,
            hasNotRecorded,
        });
    }
    // "All time" can start years before anything was caught.
    const first = buckets.findIndex(bucket => bucket.total > 0);
    return {
        granularity,
        series,
        buckets: first > 0 ? buckets.slice(first) : buckets,
        total,
    };
}
