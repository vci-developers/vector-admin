'use client';

import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { monthlyChartLabelFits } from '@/features/dashboard/utils/monthly-chart-label-fits';
import type { ColoredSeries } from '@/features/dashboard/utils/build-species-months';
import { focusedAxisMax } from '@/features/dashboard/utils/focused-axis-max';
import { useFormatter } from 'next-intl';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import TaxonName from './taxon-name';
import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    Rectangle,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import styles from './progress-monthly-chart.module.css';

function MonthlyScanLabels({
    upTo,
    hidden,
}: {
    upTo: string | null;
    /** Zoomed in, the totals sit off the top of the chart. */
    hidden: boolean;
}) {
    const formatter = useFormatter();

    return (
        <LabelList
            // Read the bar's own value: after the range shrinks, Recharts
            // still passes the previous bars for one render.
            valueAccessor={entry => {
                // An empty month has no bar, so no label either.
                if (
                    hidden ||
                    typeof entry.value !== 'number' ||
                    entry.value === 0
                )
                    return undefined;
                // The timeline hasn't reached this month yet.
                const month = (entry.payload as { month?: string } | undefined)
                    ?.month;
                if (upTo !== null && month !== undefined && month > upTo)
                    return undefined;
                const value = formatter.number(entry.value);
                return 'width' in entry &&
                    monthlyChartLabelFits(value, entry.width)
                    ? value
                    : undefined;
            }}
            position="top"
            offset={12}
            fill="var(--progress-ink, var(--foreground))"
            fontSize={13}
            fontWeight={600}
        />
    );
}

type MonthRow = {
    month: string;
    count: number;
    stephensi?: number;
    /** Specimens per species series key, for the stacked bars. */
    specimens?: Record<string, number>;
    /** The month's scans, when `count` is its specimens instead. */
    scans?: number;
};

type SegmentState = { transform: string; opacity: number };

/**
 * Where each segment was last drawn, by month and species, and the glide it
 * is in, so a rebuilt segment carries on from the same point.
 */
type DrawnSegments = Map<
    string,
    SegmentState & {
        /** `start` stays null until the glide's first frame is painted. */
        glide?: { from: SegmentState; start: number | null };
    }
>;

const GROW_MS = 450;
/**
 * A month change re-renders the whole page, and Firefox times an animation
 * from the frame before that render: hold the start state through it.
 */
const GROW_HOLD_MS = 120;

/**
 * A unit-high rect, placed and sized by transform. Recharts rebuilds bar
 * shapes on every update, so each segment glides from where it was last drawn,
 * or up from the baseline the first time.
 */
function Segment({
    id,
    drawn,
    x,
    width,
    fill,
    transform,
    from,
    opacity,
}: {
    id: string;
    drawn: DrawnSegments;
    x: number;
    width: number;
    fill: string;
    transform: string;
    /** The flat start for a segment never drawn before. */
    from: string;
    opacity: number;
}) {
    const ref = useRef<SVGRectElement>(null);
    useLayoutEffect(() => {
        const last = drawn.get(id);
        const target = { transform, opacity };
        let glide = last?.glide;
        if (!last || last.transform !== transform || last.opacity !== opacity) {
            // Recharts draws one pass with the old axis before the new one. A
            // glide not yet painted, or still holding, shows its start, so the
            // next one starts there too, not at that unseen pass.
            const holding =
                last?.glide &&
                (last.glide.start === null ||
                    performance.now() - last.glide.start < GROW_HOLD_MS);
            glide = {
                from: holding
                    ? last.glide!.from
                    : (last ?? { transform: from, opacity }),
                start: null,
            };
        }
        drawn.set(id, { ...target, glide });
        if (!glide) return;
        const elapsed =
            glide.start === null ? 0 : performance.now() - glide.start;
        if (elapsed >= GROW_HOLD_MS + GROW_MS) return;
        // Species stepping back fade early, before they stretch off the top;
        // ones coming back fade in late, once they're near their place.
        const fading = target.opacity < glide.from.opacity;
        const brightening = target.opacity > glide.from.opacity;
        const keyframes: Keyframe[] = fading
            ? [glide.from, { opacity: target.opacity, offset: 0.12 }, target]
            : brightening
              ? [
                    glide.from,
                    { opacity: glide.from.opacity, offset: 0.9 },
                    target,
                ]
              : [glide.from, target];
        const animation = ref.current?.animate(keyframes, {
            duration: GROW_MS,
            delay: GROW_HOLD_MS - elapsed,
            fill: 'backwards',
            easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
        });
        const current = glide;
        if (animation && current.start === null)
            void animation.ready.then(() => {
                if (current.start === null && animation.startTime !== null)
                    current.start = Number(animation.startTime);
            });
    }, [id, drawn, transform, from, opacity]);
    return (
        <rect
            ref={ref}
            x={x}
            y={0}
            width={width}
            height={1}
            fill={fill}
            className={styles.segment}
            style={{ transform, opacity }}
        />
    );
}

/**
 * One scan bar split by each species' share of the month's specimens, the
 * focused species at the base and the rest faded.
 */
function SpeciesBar(
    props: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        index?: number;
        payload?: MonthRow;
    },
    series: readonly ColoredSeries[],
    focused: string | null,
    upTo: string | null,
    radius: [number, number, number, number],
    clipPrefix: string,
    drawn: DrawnSegments,
) {
    const { x = 0, y = 0, width = 0, height = 0, index = 0, payload } = props;
    if (height <= 0) return <g />;
    // Months the timeline hasn't reached sit flat, ready to grow.
    const shown = upTo === null || (payload?.month ?? '') <= upTo;
    const counts = payload?.specimens ?? {};
    const total = series.reduce((sum, row) => sum + (counts[row.key] ?? 0), 0);
    const ordered = focused
        ? [
              ...series.filter(row => row.key === focused),
              ...series.filter(row => row.key !== focused),
          ]
        : series;
    // Scans with no specimens yet still get a bar, in Other's colour.
    const segments =
        total === 0
            ? [
                  {
                      key: 'none',
                      color: 'var(--progress-species-other)',
                      share: 1,
                  },
              ]
            : ordered.map(row => ({
                  key: row.key,
                  color: row.color,
                  share: (counts[row.key] ?? 0) / total,
              }));
    const clipId = `${clipPrefix}-${index}`;
    let below = 0;
    return (
        <g clipPath={`url(#${clipId})`}>
            <defs>
                <clipPath id={clipId}>
                    <Rectangle
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        radius={radius}
                    />
                </clipPath>
            </defs>
            {segments.map(segment => {
                const part = shown ? height * segment.share : 0;
                below += part;
                return (
                    <Segment
                        key={segment.key}
                        id={`${payload?.month}|${segment.key}`}
                        drawn={drawn}
                        x={x}
                        width={width}
                        fill={segment.color}
                        transform={`translateY(${y + height - below}px) scaleY(${part})`}
                        from={`translateY(${y + height}px) scaleY(0)`}
                        opacity={focused && segment.key !== focused ? 0.1 : 1}
                    />
                );
            })}
        </g>
    );
}

// Stephensi counts specimens and scans count images (1–2 per specimen), so
// the slice is close to scale, not exact.
function stephensiSliceHeight(row: MonthRow, barHeight: number): number {
    if (!row.stephensi || row.count <= 0) return 0;
    return Math.min(barHeight, (barHeight * row.stephensi) / row.count);
}

/**
 * One scan bar with its An. stephensi share as a magenta base. Drawn as one
 * shape, not a stack: Recharts orders a stack by when each bar mounts.
 */
function ScanBar(
    props: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        payload?: MonthRow;
    },
    fill: string,
    radius: [number, number, number, number],
) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    if (height <= 0) return <g />;
    const slice = payload ? stephensiSliceHeight(payload, height) : 0;
    const sliceTop = y + height - slice;
    return (
        <g>
            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                radius={radius}
                fill={fill}
            />
            {slice > 0 && (
                <>
                    <rect
                        x={x}
                        y={sliceTop}
                        width={width}
                        height={slice}
                        fill="var(--progress-stephensi)"
                    />
                    {slice < height && (
                        // A card-coloured line reads as a gap from the scans above.
                        <line
                            x1={x}
                            x2={x + width}
                            y1={sliceTop}
                            y2={sliceTop}
                            stroke="var(--card)"
                            strokeWidth={2}
                        />
                    )}
                </>
            )}
        </g>
    );
}

/** The stephensi count inside its slice, where the slice has room for it. */
function StephensiSliceLabels({ months }: { months: MonthRow[] }) {
    const formatter = useFormatter();

    return (
        <LabelList
            dataKey="stephensi"
            content={props => {
                const row = months[Number(props.index)];
                if (!row?.stephensi) return null;
                const height = Number(props.height);
                const width = Number(props.width);
                const slice = stephensiSliceHeight(row, height);
                const text = formatter.number(row.stephensi);
                if (slice < 18 || width < 10 + text.length * 6.5) return null;
                return (
                    <text
                        aria-hidden="true"
                        x={Number(props.x) + width / 2}
                        y={Number(props.y) + height - slice + 13}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={10}
                        fontWeight={650}
                    >
                        {text}
                    </text>
                );
            }}
        />
    );
}

export default function ProgressMonthlyChart({
    months,
    seriesName = 'Scans',
    color = 'var(--primary)',
    species,
    focusedSpecies = null,
    upTo = null,
    compact = false,
    unitLabel,
    selectedMonth = null,
    onMonthSelect,
}: {
    /** The month the map shows alone; the other bars step back. */
    selectedMonth?: string | null;
    /** A bar's click: its month, or null when it was already the one shown. */
    onMonthSelect?: (month: string | null) => void;
    /** The tooltip total's unit; the series name, lowercased, by default. */
    unitLabel?: ReactNode;
    /** `stephensi` marks months with An. stephensi specimens above the bar. */
    months: MonthRow[];
    seriesName?: string;
    color?: string;
    /** When given, each bar splits by these species' `specimens`. */
    species?: readonly ColoredSeries[];
    /** A species key to bring to the base of each bar, the rest faded. */
    focusedSpecies?: string | null;
    /** The timeline's month: later bars wait flat and grow as it passes. */
    upTo?: string | null;
    /** Shorter, for the timeline panel, so the species list fits below. */
    compact?: boolean;
}) {
    const formatter = useFormatter();
    const clipPrefix = `species-bar-${useId().replace(/:/g, '')}`;
    const drawn = useRef<DrawnSegments>(new Map()).current;
    const colored = species && species.length > 0 ? species : null;
    const focused = colored?.some(row => row.key === focusedSpecies)
        ? focusedSpecies
        : null;
    // Zoomed to the focused species; the rest of each bar runs off the top.
    const zoomMax = focused ? focusedAxisMax(months, focused) : null;
    // Zoomed, bars count specimens, so the focused segment is its true count.
    const rows: MonthRow[] =
        zoomMax === null
            ? months
            : months.map(month => ({
                  ...month,
                  scans: month.count,
                  count: Object.values(month.specimens ?? {}).reduce(
                      (sum, value) => sum + value,
                      0,
                  ),
              }));
    const radius: [number, number, number, number] =
        months.length > 12 ? [2, 2, 0, 0] : [7, 7, 0, 0];
    const monthLabel = (month: string, full = false) =>
        formatter.dateTime(monthStartDate(month), {
            month: full ? 'long' : 'short',
            ...(full || months.length > 12 ? { year: 'numeric' as const } : {}),
            timeZone: 'UTC',
        });
    return (
        <div
            className={styles.chart}
            role="region"
            aria-label={`Monthly ${seriesName.toLowerCase()} for the entire selected period.`}
            tabIndex={0}
        >
            <div className={styles.canvas} data-compact={compact}>
                <BarChart
                    responsive
                    data={rows}
                    margin={{
                        top: compact ? 20 : 30,
                        right: 8,
                        bottom: 0,
                        left: -12,
                    }}
                    barCategoryGap={months.length > 12 ? '15%' : '30%'}
                    accessibilityLayer
                    // The whole month's column takes the click, as its hover
                    // shading shows, so a short bar is as easy to pick.
                    onClick={
                        onMonthSelect &&
                        (state => {
                            const month =
                                rows[Number(state.activeIndex)]?.month;
                            if (month)
                                onMonthSelect(
                                    month === selectedMonth ? null : month,
                                );
                        })
                    }
                    style={{
                        width: '100%',
                        height: '100%',
                        cursor: onMonthSelect ? 'pointer' : undefined,
                    }}
                >
                    <CartesianGrid
                        vertical={false}
                        stroke="var(--border)"
                        strokeDasharray="2 5"
                    />
                    <XAxis
                        dataKey="month"
                        tickFormatter={month => monthLabel(String(month))}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                            fill: 'var(--muted-foreground)',
                            fontSize: 12,
                        }}
                        tickMargin={16}
                        interval="preserveStartEnd"
                        minTickGap={16}
                        height={42}
                    />
                    <YAxis
                        allowDecimals={false}
                        domain={zoomMax === null ? undefined : [0, zoomMax]}
                        allowDataOverflow={zoomMax !== null}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                            fill: 'var(--muted-foreground)',
                            fontSize: 11,
                        }}
                        tickFormatter={value =>
                            formatter.number(Number(value), {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                            })
                        }
                        width={52}
                        tickCount={5}
                    />
                    <Tooltip
                        // Follows the pointer, close by, and moves without a lag.
                        offset={14}
                        animationDuration={120}
                        allowEscapeViewBox={{ x: false, y: true }}
                        wrapperStyle={{ zIndex: 10, pointerEvents: 'none' }}
                        cursor={{ fill: 'var(--muted)', radius: 8 }}
                        content={({ active, payload, label }) => {
                            const row = payload?.[0]?.payload as
                                (typeof months)[number] | undefined;
                            if (!active || !row) return null;
                            if (upTo !== null && row.month > upTo) return null;
                            // The focused species stays listed, even at none.
                            const breakdown: [
                                string,
                                number,
                                string,
                                boolean,
                            ][] = colored
                                ? colored
                                      .filter(
                                          item =>
                                              item.key === focused ||
                                              (row.specimens?.[item.key] ?? 0) >
                                                  0,
                                      )
                                      .map(item => [
                                          item.name,
                                          row.specimens?.[item.key] ?? 0,
                                          item.color,
                                          item.key === focused,
                                      ])
                                : row.stephensi
                                  ? [
                                        [
                                            'An. stephensi',
                                            row.stephensi,
                                            'var(--progress-stephensi)',
                                            false,
                                        ],
                                    ]
                                  : [];
                            return (
                                <div className={styles.tooltip}>
                                    <p className={styles.tooltipMonth}>
                                        {monthLabel(String(label), true)}
                                    </p>
                                    <p className={styles.tooltipTotal}>
                                        {formatter.number(
                                            row.scans ?? row.count,
                                        )}{' '}
                                        {unitLabel ?? seriesName.toLowerCase()}
                                    </p>
                                    {breakdown.length > 0 && (
                                        <>
                                            <ul className={styles.tooltipRows}>
                                                {breakdown.map(
                                                    ([
                                                        name,
                                                        value,
                                                        swatch,
                                                        highlighted,
                                                    ]) => (
                                                        <li
                                                            key={name}
                                                            data-focused={
                                                                focused === null
                                                                    ? undefined
                                                                    : highlighted
                                                            }
                                                            style={{
                                                                ['--swatch' as string]:
                                                                    swatch,
                                                            }}
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                style={{
                                                                    background:
                                                                        swatch,
                                                                }}
                                                            />
                                                            <TaxonName
                                                                name={name}
                                                            />
                                                            <b>
                                                                {formatter.number(
                                                                    value,
                                                                )}
                                                            </b>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            );
                        }}
                    />
                    <Bar
                        dataKey="count"
                        name={seriesName}
                        fill={color}
                        shape={(props: Parameters<typeof SpeciesBar>[0]) => (
                            <g
                                opacity={
                                    selectedMonth !== null &&
                                    props.payload?.month !== selectedMonth
                                        ? 0.35
                                        : 1
                                }
                            >
                                {colored
                                    ? SpeciesBar(
                                          props,
                                          colored,
                                          focused,
                                          upTo,
                                          radius,
                                          clipPrefix,
                                          drawn,
                                      )
                                    : ScanBar(props, color, radius)}
                            </g>
                        )}
                        maxBarSize={72}
                        isAnimationActive={false}
                    >
                        <MonthlyScanLabels
                            upTo={upTo}
                            hidden={zoomMax !== null}
                        />
                        {!colored && <StephensiSliceLabels months={months} />}
                    </Bar>
                </BarChart>
            </div>
        </div>
    );
}
