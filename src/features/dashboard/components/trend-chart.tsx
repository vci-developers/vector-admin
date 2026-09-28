'use client';

import type { MonthMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricDefinition } from '@/features/dashboard/utils/metric-definitions';
import { useFormatter, useTranslations } from 'next-intl';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useFormatMetric } from './metric-value';

export type TrendSeries = {
    programId: number;
    name: string;
    color: string;
    months: Record<string, MonthMetricsDto>;
    cycleLabels: Record<string, number[]>;
};

type TrendChartProps = {
    metric: MetricDefinition;
    months: string[];
    series: TrendSeries[];
    selectedMonth: string;
    onSelectMonth: (month: string) => void;
};

function monthDate(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber - 1, 1));
}

export default function TrendChart({
    metric,
    months,
    series,
    selectedMonth,
    onSelectMonth,
}: TrendChartProps) {
    const t = useTranslations('Metrics');
    const tTrends = useTranslations('Trends');
    const formatter = useFormatter();
    const formatMetric = useFormatMetric();
    const monthLabel = (month: string, style: 'short' | 'long') =>
        formatter.dateTime(monthDate(month), {
            month: style,
            year: style === 'long' ? 'numeric' : '2-digit',
            timeZone: 'UTC',
        });

    const data = months.map(month => ({
        month,
        ...Object.fromEntries(
            series.map(s => [
                s.programId,
                s.months[month] ? metric.value(s.months[month]) : null,
            ]),
        ),
    }));

    function TooltipContent({
        active,
        label,
    }: {
        active?: boolean;
        label?: string | number;
    }) {
        if (!active || typeof label !== 'string') return null;
        const rows = series
            .map(s => ({
                ...s,
                value: s.months[label] ? metric.value(s.months[label]) : null,
            }))
            .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
        const onlySeries = series.length === 1 ? series[0] : undefined;
        const cycles = onlySeries?.cycleLabels[label] ?? [];

        return (
            <div className="bg-popover text-popover-foreground min-w-44 rounded-md border px-3 py-2 text-xs shadow-md">
                <p className="mb-1 font-medium">
                    {monthLabel(label, 'long')}
                    {cycles.length > 0 && (
                        <span className="text-muted-foreground font-normal">
                            {' · '}
                            {tTrends('cycles', {
                                count: cycles.length,
                                numbers: cycles.join(', '),
                            })}
                        </span>
                    )}
                </p>
                {rows.map(row => (
                    <p key={row.programId} className="flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="h-0.5 w-3 shrink-0 rounded-full"
                            style={{ background: row.color }}
                        />
                        <span className="text-muted-foreground flex-1">
                            {row.name}
                        </span>
                        <span className="font-medium tabular-nums">
                            {row.value === null
                                ? '—'
                                : formatMetric(row.value, metric.format)}
                        </span>
                    </p>
                ))}
            </div>
        );
    }

    return (
        <Card className="gap-2 py-4">
            <CardHeader className="px-4">
                <CardTitle className="text-sm">
                    {t(`${metric.key}.title`)}
                </CardTitle>
            </CardHeader>
            <CardContent className="h-44 px-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                        onClick={state => {
                            if (typeof state.activeLabel === 'string') {
                                onSelectMonth(state.activeLabel);
                            }
                        }}
                        className="cursor-pointer"
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--chart-grid)"
                        />
                        <XAxis
                            dataKey="month"
                            tickFormatter={month => monthLabel(month, 'short')}
                            tick={{
                                fontSize: 11,
                                fill: 'var(--muted-foreground)',
                            }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                            minTickGap={16}
                        />
                        <YAxis
                            width={44}
                            tick={{
                                fontSize: 11,
                                fill: 'var(--muted-foreground)',
                            }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={value =>
                                formatMetric(value, metric.format)
                            }
                            domain={
                                metric.format === 'percent'
                                    ? [0, 1]
                                    : [0, 'auto']
                            }
                            allowDecimals={metric.format !== 'count'}
                        />
                        <ReferenceLine
                            x={selectedMonth}
                            stroke="var(--muted-foreground)"
                            strokeDasharray="3 3"
                        />
                        <Tooltip
                            content={TooltipContent}
                            cursor={{ stroke: 'var(--border)' }}
                            isAnimationActive={false}
                        />
                        {series.map(s => (
                            <Line
                                key={s.programId}
                                dataKey={String(s.programId)}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{
                                    r: 4,
                                    strokeWidth: 2,
                                    stroke: 'var(--card)',
                                }}
                                isAnimationActive={false}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
