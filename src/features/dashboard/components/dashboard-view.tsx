'use client';

import { useGetDashboard } from '@/api/dashboard/hooks/use-get-dashboard';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import {
    resolveReportingRange,
    resolveSelectedMonth,
} from '@/features/dashboard/utils/resolve-reporting-range';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import DashboardSkeleton from './dashboard-skeleton';
import MonthSummary from './month-summary';
import ProgramFilter from './program-filter';
import RangePicker from './range-picker';
import RefreshControl from './refresh-control';
import TrendCharts from './trend-charts';

function currentMonthKey(now: Date) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardView() {
    const t = useTranslations('Dashboard');
    const [filters] = useDashboardFilters();
    const { range, month, currentMonth } = useMemo(() => {
        const now = new Date();
        const resolved = resolveReportingRange(
            filters.range,
            { from: filters.from, to: filters.to },
            now,
        );
        return {
            range: resolved,
            month: resolveSelectedMonth(filters.month, resolved, now),
            currentMonth: currentMonthKey(now),
        };
    }, [filters.range, filters.from, filters.to, filters.month]);

    const dashboardQuery = useGetDashboard({
        exclude: filters.exclude,
        ...range,
        month,
    });
    const result = dashboardQuery.data;

    if (!result) return <DashboardSkeleton message={t('loading')} />;
    if (!result.ok) {
        return (
            <p
                role="alert"
                className="text-destructive flex items-center gap-2"
            >
                <AlertTriangle className="size-4" aria-hidden="true" />
                {t('loadError')}
            </p>
        );
    }

    const dashboard = result.data;
    const failedNames = dashboard.programs
        .filter(program =>
            dashboard.failedProgramIds.includes(program.programId),
        )
        .map(program => program.name);
    // All time resolves its start on the server; keep the month inside what came back.
    const summaryMonth = dashboard.metrics.months.includes(month)
        ? month
        : (dashboard.metrics.months.at(-1) ?? month);

    return (
        <div className="flex flex-col gap-8">
            <div className="bg-background/95 sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                    <ProgramFilter programs={dashboard.programs} />
                    <RangePicker range={range} currentMonth={currentMonth} />
                </div>
                <RefreshControl
                    lastUpdatedAt={dashboard.lastUpdatedAt}
                    programIds={dashboard.selectedProgramIds}
                    isRefetching={dashboardQuery.isFetching}
                />
            </div>
            {failedNames.length > 0 && (
                <p
                    role="alert"
                    className="border-destructive/40 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm"
                >
                    <AlertTriangle
                        className="size-4 shrink-0"
                        aria-hidden="true"
                    />
                    {t('failedPrograms', { names: failedNames.join(', ') })}
                </p>
            )}
            {dashboard.selectedProgramIds.length === 0 ? (
                <p className="text-muted-foreground">
                    {t('noProgramsSelected')}
                </p>
            ) : (
                <>
                    <MonthSummary dashboard={dashboard} month={summaryMonth} />
                    <TrendCharts dashboard={dashboard} month={summaryMonth} />
                </>
            )}
        </div>
    );
}
