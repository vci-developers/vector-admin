'use client';

import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { monthlyChartLabelFits } from '@/features/dashboard/utils/monthly-chart-label-fits';
import { useFormatter } from 'next-intl';
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

function MonthlyScanLabels() {
    const formatter = useFormatter();

    return (
        <LabelList
            // Read the bar's own value: after the range shrinks, Recharts
            // still passes the previous bars for one render.
            valueAccessor={entry => {
                // An empty month has no bar, so no label either.
                if (typeof entry.value !== 'number' || entry.value === 0)
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

type MonthRow = { month: string; count: number; stephensi?: number };

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
}: {
    /** `stephensi` marks months with An. stephensi specimens above the bar. */
    months: MonthRow[];
    seriesName?: string;
    color?: string;
}) {
    const formatter = useFormatter();
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
            <div className={styles.canvas}>
                <BarChart
                    responsive
                    style={{ width: '100%', height: '100%' }}
                    data={months}
                    margin={{
                        top: 30,
                        right: 8,
                        bottom: 0,
                        left: -12,
                    }}
                    barCategoryGap={months.length > 12 ? '15%' : '30%'}
                    accessibilityLayer
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
                        position={{ x: 8, y: 8 }}
                        cursor={{ fill: 'var(--muted)', radius: 8 }}
                        // Custom so stephensi gets a row like the series': "Name : value".
                        content={({ active, payload, label }) => {
                            const row = payload?.[0]?.payload as
                                (typeof months)[number] | undefined;
                            if (!active || !row) return null;
                            const rows: [string, number, string][] = [
                                [seriesName, row.count, color],
                                ...(row.stephensi
                                    ? [
                                          [
                                              'An. stephensi',
                                              row.stephensi,
                                              'var(--progress-stephensi)',
                                          ] as [string, number, string],
                                      ]
                                    : []),
                            ];
                            return (
                                <div
                                    style={{
                                        background: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        padding: '12px 16px',
                                        fontSize: 13,
                                        boxShadow:
                                            '0 8px 24px rgb(20 55 43 / 10%)',
                                    }}
                                >
                                    <p style={{ color: 'var(--foreground)' }}>
                                        {monthLabel(String(label), true)}
                                    </p>
                                    <ul>
                                        {rows.map(([name, value, rowColor]) => (
                                            <li
                                                key={name}
                                                style={{
                                                    color: rowColor,
                                                    padding: '4px 0',
                                                }}
                                            >
                                                {name} :{' '}
                                                {formatter.number(value)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        }}
                    />
                    <Bar
                        dataKey="count"
                        name={seriesName}
                        fill={color}
                        shape={(props: Parameters<typeof ScanBar>[0]) =>
                            ScanBar(
                                props,
                                color,
                                months.length > 12
                                    ? [2, 2, 0, 0]
                                    : [7, 7, 0, 0],
                            )
                        }
                        maxBarSize={72}
                        isAnimationActive={false}
                    >
                        <MonthlyScanLabels />
                        <StephensiSliceLabels months={months} />
                    </Bar>
                </BarChart>
            </div>
        </div>
    );
}
