'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { METRICS } from '@/features/dashboard/utils/metric-definitions';
import { programSeriesColor } from '@/features/dashboard/utils/series-colors';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import TrendChart, { type TrendSeries } from './trend-chart';

export default function TrendCharts({
    dashboard,
    month,
}: {
    dashboard: Dashboard;
    month: string;
}) {
    const t = useTranslations('Trends');
    const [, setFilters] = useDashboardFilters();

    const series = useMemo<TrendSeries[]>(() => {
        const allProgramIds = dashboard.programs.map(p => p.programId);
        const names = new Map(
            dashboard.programs.map(p => [p.programId, p.name]),
        );
        return dashboard.metrics.programs.map(p => ({
            programId: p.programId,
            name: names.get(p.programId) ?? String(p.programId),
            color: programSeriesColor(p.programId, allProgramIds),
            months: p.months,
            cycleLabels: p.cycleLabels,
        }));
    }, [dashboard]);

    return (
        <section
            aria-labelledby="trends-heading"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 id="trends-heading" className="text-lg font-semibold">
                        {t('heading')}
                    </h2>
                    <p className="text-muted-foreground text-sm">{t('hint')}</p>
                </div>
                <ul
                    className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                    aria-label={t('legend')}
                >
                    {series.map(s => (
                        <li
                            key={s.programId}
                            className="flex items-center gap-2"
                        >
                            <span
                                aria-hidden="true"
                                className="h-0.5 w-4 rounded-full"
                                style={{ background: s.color }}
                            />
                            {s.name}
                        </li>
                    ))}
                </ul>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {METRICS.map(metric => (
                    <TrendChart
                        key={metric.key}
                        metric={metric}
                        months={dashboard.metrics.months}
                        series={series}
                        selectedMonth={month}
                        onSelectMonth={nextMonth =>
                            setFilters({ month: nextMonth })
                        }
                    />
                ))}
            </div>
        </section>
    );
}
