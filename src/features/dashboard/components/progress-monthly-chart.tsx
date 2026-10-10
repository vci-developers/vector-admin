'use client';

import type { ProgressMonth } from '@/api/progress/validation/progress-schema';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { monthlyChartMinimumWidth } from '@/features/dashboard/utils/monthly-chart-minimum-width';
import { useFormatter } from 'next-intl';
import { useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import styles from './progress-monthly-chart.module.css';

export default function ProgressMonthlyChart({
    months,
}: {
    months: ProgressMonth[];
}) {
    const formatter = useFormatter();
    const [scrollLeft, setScrollLeft] = useState(0);
    const monthLabel = (month: string, full = false) =>
        formatter.dateTime(monthStartDate(month), {
            month: full ? 'long' : 'short',
            ...(full || months.length > 12 ? { year: 'numeric' as const } : {}),
            timeZone: 'UTC',
        });
    const minimumWidth = monthlyChartMinimumWidth(
        months.map(month => ({
            value: formatter.number(month.uniqueScans),
            month: monthLabel(month.month),
        })),
    );

    return (
        <div
            className={styles.scroller}
            role="region"
            aria-label="Monthly VectorCam scans. Scroll horizontally to see additional months."
            tabIndex={0}
            onScroll={event => setScrollLeft(event.currentTarget.scrollLeft)}
        >
            <div className={styles.canvas} style={{ minWidth: minimumWidth }}>
                <BarChart
                    responsive
                    style={{ width: '100%', height: '100%' }}
                    data={months}
                    margin={{ top: 30, right: 8, bottom: 0, left: -12 }}
                    barCategoryGap="30%"
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
                        interval={0}
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
                        position={{ x: scrollLeft + 8, y: 8 }}
                        cursor={{ fill: 'var(--muted)', radius: 8 }}
                        labelFormatter={month =>
                            monthLabel(String(month), true)
                        }
                        formatter={value => [
                            formatter.number(Number(value)),
                            'Scans',
                        ]}
                        contentStyle={{
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: '12px 16px',
                            fontSize: 13,
                            boxShadow: '0 8px 24px rgb(20 55 43 / 10%)',
                        }}
                        labelStyle={{ color: 'var(--foreground)' }}
                        itemStyle={{ color: 'var(--primary)' }}
                    />
                    <Bar
                        dataKey="uniqueScans"
                        name="Scans"
                        fill="var(--primary)"
                        radius={[7, 7, 0, 0]}
                        maxBarSize={72}
                        isAnimationActive={false}
                    >
                        <LabelList
                            dataKey="uniqueScans"
                            position="top"
                            offset={12}
                            fill="var(--progress-ink, var(--foreground))"
                            fontSize={13}
                            fontWeight={600}
                            formatter={value => formatter.number(Number(value))}
                        />
                    </Bar>
                </BarChart>
            </div>
        </div>
    );
}
