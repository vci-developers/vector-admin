'use client';

import {
    type SelectionTimeline,
    type TimelineBucket,
    type TimelineSeries,
} from '@/features/dashboard/utils/build-selection-timeline';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/utils/cn';
import { useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { MouseHandlerDataParam } from 'recharts/types/synchronisation/types';

const RADIUS = 4;

export const seriesColor = (series: TimelineSeries) =>
    series.kind === 'folded'
        ? 'var(--series-other)'
        : `var(--series-${series.slot + 1})`;

export function useSeriesLabel() {
    const t = useTranslations('MapSection');
    return (series: TimelineSeries) =>
        series.kind === 'value'
            ? series.value
            : series.hasNamed && series.hasNotRecorded
              ? t('chartOtherOrNotRecorded')
              : series.hasNamed
                ? t('chartOther')
                : t('chartNotRecorded');
}

type Row = { bucket: TimelineBucket; top: number } & Record<string, unknown>;

type SegmentProps = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    payload?: Row;
    index: number;
};

/** A stacked segment: only the top one of each column gets the rounded end. */
function Segment({
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    fill,
    payload,
    index,
}: SegmentProps) {
    if (height <= 0 || width <= 0) return null;
    const r = payload?.top === index ? Math.min(RADIUS, height, width / 2) : 0;
    const path = `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
    // The surface-coloured stroke is the 2px gap between touching segments;
    // on bars too thin to spare it, it would swallow the bar, so it thins out.
    return (
        <path
            d={path}
            fill={fill}
            stroke="var(--card)"
            strokeWidth={width >= 8 ? 2 : width >= 4 ? 1 : 0}
        />
    );
}

export const CHART_VIEWS = ['pie', 'stacked', 'lines', 'totals'] as const;
export type ChartView = (typeof CHART_VIEWS)[number];

type SeriesTotal = { series: TimelineSeries; count: number };

/** Each series' total for the period, most common first, "Other" last. */
function seriesTotals(timeline: SelectionTimeline): SeriesTotal[] {
    return timeline.series
        .map(s => ({
            series: s,
            count: timeline.buckets.reduce(
                (sum, b) => sum + (b.counts[s.key] ?? 0),
                0,
            ),
        }))
        .filter(item => item.count > 0)
        .sort(
            (a, b) =>
                Number(a.series.kind === 'folded') -
                    Number(b.series.kind === 'folded') || b.count - a.count,
        );
}

/**
 * The legend doubles as the hover readout, so nothing floats over the chart:
 * each entry shows the hovered week's (or month's) count, or the period's
 * total when nothing is hovered. One row per series keeps its height steady.
 */
function ValueLegend({
    timeline,
    bucket,
    bucketLabel,
}: {
    timeline: SelectionTimeline;
    bucket: TimelineBucket | null;
    bucketLabel: (bucket: TimelineBucket) => string;
}) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const label = useSeriesLabel();
    const periodTotals = new Map(
        seriesTotals(timeline).map(item => [item.series.key, item.count]),
    );
    const countOf = (key: string) =>
        bucket ? (bucket.counts[key] ?? 0) : (periodTotals.get(key) ?? 0);
    return (
        <div className="flex flex-col gap-1 text-xs" aria-live="polite">
            <p className="text-muted-foreground">
                {bucket
                    ? t('chartReadoutBucket', {
                          bucket: bucketLabel(bucket),
                          total: formatter.number(bucket.total),
                      })
                    : t('chartReadoutPeriod')}
            </p>
            <ul
                aria-label={t('chartLegend')}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5"
            >
                {timeline.series.map(s => (
                    <li key={s.key} className="contents">
                        <span
                            aria-hidden="true"
                            className="size-2.5 rounded-[3px]"
                            style={{ background: seriesColor(s) }}
                        />
                        <span className="truncate">{label(s)}</span>
                        <span
                            className={
                                countOf(s.key) === 0
                                    ? 'text-muted-foreground/60 tabular-nums'
                                    : 'tabular-nums'
                            }
                        >
                            {formatter.number(countOf(s.key))}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const PIE_SLICES = 6;

/**
 * Part-to-whole at a glance: at most six slices, so values past the fifth
 * largest join "Other". Percentages ride in the legend, not on the slices.
 */
function PieView({ timeline }: { timeline: SelectionTimeline }) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const label = useSeriesLabel();
    const [hovered, setHovered] = useState<number | null>(null);
    const totals = seriesTotals(timeline);
    const named = totals.filter(item => item.series.kind === 'value');
    const kept = named.slice(0, PIE_SLICES - 1);
    const rest = totals.filter(item => !kept.includes(item));
    const restCount = rest.reduce((sum, item) => sum + item.count, 0);
    const slices: SeriesTotal[] = [
        ...kept,
        ...(restCount > 0
            ? [
                  {
                      series: {
                          kind: 'folded' as const,
                          key: 'folded' as const,
                          hasNamed: rest.some(
                              item =>
                                  item.series.kind === 'value' ||
                                  item.series.hasNamed,
                          ),
                          hasNotRecorded: rest.some(
                              item =>
                                  item.series.kind === 'folded' &&
                                  item.series.hasNotRecorded,
                          ),
                      },
                      count: restCount,
                  },
              ]
            : []),
    ];
    const hoveredSlice = hovered === null ? null : (slices[hovered] ?? null);
    const percent = (count: number) =>
        formatter.number(count / Math.max(1, timeline.total), {
            style: 'percent',
            maximumFractionDigits: 0,
        });
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs">
                <span className="font-medium">{t('chartTitleTotals')}</span>
                <span className="text-muted-foreground">
                    {' · '}
                    {t('chartTitleTotal', {
                        total: formatter.number(timeline.total),
                    })}
                </span>
            </p>
            <div
                className="relative h-44"
                role="img"
                aria-label={t('chartPieAria')}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices.map((item, index) => ({
                                name: label(item.series),
                                value: item.count,
                                fill: seriesColor(item.series),
                                // Dim the rest so the hovered slice stands out.
                                fillOpacity:
                                    hovered === null || hovered === index
                                        ? 1
                                        : 0.3,
                            }))}
                            dataKey="value"
                            innerRadius="64%"
                            outerRadius="95%"
                            startAngle={90}
                            endAngle={-270}
                            // The surface-coloured stroke is the gap between slices.
                            stroke="var(--card)"
                            strokeWidth={2}
                            isAnimationActive={false}
                            // The centre carries the hover readout, so no
                            // floating tooltip covers the ring.
                            onMouseEnter={(_, index) => setHovered(index)}
                            onMouseLeave={() => setHovered(null)}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Sized to sit inside the hole (h-44, inner radius 64%). */}
                <p
                    aria-live="polite"
                    className="pointer-events-none absolute top-1/2 left-1/2 flex w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-tight"
                >
                    <span className="text-lg font-semibold">
                        {hoveredSlice
                            ? percent(hoveredSlice.count)
                            : formatter.number(timeline.total, {
                                  notation: 'compact',
                              })}
                    </span>
                    <span className="line-clamp-2 w-full text-xs">
                        {hoveredSlice
                            ? label(hoveredSlice.series)
                            : t('chartAxisY')}
                    </span>
                    {hoveredSlice && (
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {formatter.number(hoveredSlice.count)}
                        </span>
                    )}
                </p>
            </div>
            <ul
                aria-label={t('chartLegend')}
                className="flex flex-col gap-1 text-xs"
            >
                {slices.map(item => (
                    <li
                        key={item.series.key}
                        className={cn(
                            'flex items-center gap-2 rounded-sm px-1 transition-colors',
                            hoveredSlice === item && 'bg-muted',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ background: seriesColor(item.series) }}
                        />
                        <span className="flex-1 truncate">
                            {label(item.series)}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                            {formatter.number(item.count)}
                        </span>
                        <span className="w-9 text-right tabular-nums">
                            {percent(item.count)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Each value's total for the period: horizontal bars, most common first. */
function TotalsChart({ timeline }: { timeline: SelectionTimeline }) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const label = useSeriesLabel();
    const totals = seriesTotals(timeline);
    const max = Math.max(1, ...totals.map(item => item.count));
    return (
        <ul aria-label={t('chartTotalsAria')} className="flex flex-col gap-2">
            {totals.map(({ series, count }) => (
                <li
                    key={series.key}
                    className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-2 text-xs"
                >
                    <span className="truncate" title={label(series)}>
                        {label(series)}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span
                            className="h-3 min-w-[2px] rounded-r-[4px]"
                            style={{
                                width: `${(count / max) * 100}%`,
                                background: seriesColor(series),
                            }}
                        />
                        <span className="shrink-0 tabular-nums">
                            {formatter.number(count)}
                        </span>
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** Specimens per week or month in the chosen view. */
export default function SelectionChart({
    timeline,
    view,
}: {
    timeline: SelectionTimeline;
    view: ChartView;
}) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const [hovered, setHovered] = useState<number | null>(null);
    const hoveredBucket =
        hovered === null ? null : (timeline.buckets[hovered] ?? null);
    const onMouseMove = (state: MouseHandlerDataParam) =>
        setHovered(
            state.activeTooltipIndex == null
                ? null
                : Number(state.activeTooltipIndex),
        );
    const onMouseLeave = () => setHovered(null);
    const years = new Set(
        timeline.buckets.map(b => new Date(b.start).getUTCFullYear()),
    );
    const quarterOf = (start: number) => ({
        quarter: Math.floor(new Date(start).getUTCMonth() / 3) + 1,
        year: new Date(start).getUTCFullYear(),
    });
    const tick = (start: number) =>
        timeline.granularity === 'quarter'
            ? t('chartQuarterTick', {
                  ...quarterOf(start),
                  short: String(quarterOf(start).year).slice(2),
              })
            : formatter.dateTime(
                  start,
                  timeline.granularity === 'week'
                      ? { month: 'short', day: 'numeric', timeZone: 'UTC' }
                      : {
                            month: 'short',
                            ...(years.size > 1 ? { year: '2-digit' } : {}),
                            timeZone: 'UTC',
                        },
              );
    const bucketLabel = (bucket: TimelineBucket) =>
        timeline.granularity === 'week'
            ? t('chartWeekOf', { date: tick(bucket.start) })
            : timeline.granularity === 'quarter'
              ? t('chartQuarter', quarterOf(bucket.start))
              : formatter.dateTime(bucket.start, {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                });

    if (view === 'pie') return <PieView timeline={timeline} />;
    if (view === 'totals') {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-xs">
                    <span className="font-medium">{t('chartTitleTotals')}</span>
                    <span className="text-muted-foreground">
                        {' · '}
                        {t('chartTitleTotal', {
                            total: formatter.number(timeline.total),
                        })}
                    </span>
                </p>
                <TotalsChart timeline={timeline} />
            </div>
        );
    }

    const rows: Row[] = timeline.buckets.map(bucket => {
        const row: Row = { bucket, top: -1, start: bucket.start };
        timeline.series.forEach((s, index) => {
            const count = bucket.counts[s.key] ?? 0;
            row[`s${index}`] = count;
            if (count > 0) row.top = index;
        });
        return row;
    });
    const axisText = { fill: 'var(--muted-foreground)', fontSize: 11 };
    const common = [
        <CartesianGrid
            key="grid"
            vertical={false}
            stroke="var(--chart-grid)"
        />,
        <XAxis
            key="x"
            dataKey="start"
            tickFormatter={tick}
            tick={axisText}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            interval="preserveStartEnd"
            minTickGap={12}
            label={{
                value: t(`chartAxisX.${timeline.granularity}`),
                position: 'insideBottom',
                offset: -12,
                ...axisText,
            }}
        />,
        <YAxis
            key="y"
            allowDecimals={false}
            tickFormatter={value =>
                formatter.number(value, { notation: 'compact' })
            }
            tick={axisText}
            tickLine={false}
            axisLine={false}
            width={44}
            label={{
                value: t('chartAxisY'),
                angle: -90,
                position: 'insideLeft',
                offset: 4,
                style: { textAnchor: 'middle' },
                ...axisText,
            }}
        />,
        <Tooltip
            key="tooltip"
            cursor={
                view === 'stacked'
                    ? { fill: 'var(--muted)', opacity: 0.5 }
                    : { stroke: 'var(--muted-foreground)', strokeWidth: 1 }
            }
            // The legend below carries the hover readout instead.
            content={() => null}
        />,
    ];
    const margin = { top: 4, right: 8, bottom: 14, left: 4 };

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">
                {t(`chartTitle.${timeline.granularity}`)}
            </p>
            <div
                className="h-52"
                role="img"
                aria-label={t('chartAria', {
                    total: timeline.total,
                    granularity: timeline.granularity,
                })}
            >
                <ResponsiveContainer width="100%" height="100%">
                    {view === 'stacked' ? (
                        <BarChart
                            data={rows}
                            margin={margin}
                            barCategoryGap="20%"
                            onMouseMove={onMouseMove}
                            onMouseLeave={onMouseLeave}
                        >
                            {common}
                            {timeline.series.map((s, index) => (
                                <Bar
                                    key={s.key}
                                    dataKey={`s${index}`}
                                    stackId="specimens"
                                    fill={seriesColor(s)}
                                    maxBarSize={24}
                                    isAnimationActive={false}
                                    shape={(props: unknown) => (
                                        <Segment
                                            {...(props as SegmentProps)}
                                            index={index}
                                        />
                                    )}
                                />
                            ))}
                        </BarChart>
                    ) : (
                        <LineChart
                            data={rows}
                            margin={margin}
                            onMouseMove={onMouseMove}
                            onMouseLeave={onMouseLeave}
                        >
                            {common}
                            {timeline.series.map((s, index) => (
                                <Line
                                    key={s.key}
                                    dataKey={`s${index}`}
                                    type="linear"
                                    stroke={seriesColor(s)}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    // Dots only on the hovered week: a dot on
                                    // every empty week crowds the baseline.
                                    dot={false}
                                    activeDot={{
                                        r: 4,
                                        stroke: 'var(--card)',
                                        strokeWidth: 2,
                                    }}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
            <ValueLegend
                timeline={timeline}
                bucket={hoveredBucket}
                bucketLabel={bucketLabel}
            />
        </div>
    );
}
