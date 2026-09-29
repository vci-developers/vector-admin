'use client';

import { useGetDashboard } from '@/api/dashboard/hooks/use-get-dashboard';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import { resolveReportingRange } from '@/features/dashboard/utils/resolve-reporting-range';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import DashboardSkeleton from './dashboard-skeleton';
import MapSection from './map-section';
import PeriodSummary from './period-summary';
import ProgramFilter from './program-filter';
import RangePicker from './range-picker';
import RefreshControl from './refresh-control';
import UsersSection from './users-section';

function currentMonthKey(now: Date) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardView() {
    const t = useTranslations('Dashboard');
    const periodLabel = usePeriodLabel();
    const [filters] = useDashboardFilters();
    const { range, currentMonth } = useMemo(() => {
        const now = new Date();
        return {
            range: resolveReportingRange(
                filters.range,
                { from: filters.from, to: filters.to },
                now,
            ),
            currentMonth: currentMonthKey(now),
        };
    }, [filters.range, filters.from, filters.to]);

    const dashboardQuery = useGetDashboard({
        exclude: filters.exclude,
        ...range,
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
    const { from, to } = dashboard.metrics;
    const period = { from, to, label: periodLabel(from, to) };
    const failedNames = dashboard.programs
        .filter(program =>
            dashboard.failedProgramIds.includes(program.programId),
        )
        .map(program => program.name);

    return (
        <div className="flex flex-col gap-8">
            <div className="bg-background/95 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:sticky sm:top-0 sm:-mx-6 sm:px-6">
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
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
                    <MapSection
                        key={`${from}:${to}`}
                        dashboard={dashboard}
                        period={period}
                    />
                    <PeriodSummary
                        key={`summary-${from}:${to}`}
                        dashboard={dashboard}
                        period={period}
                    />
                    <UsersSection dashboard={dashboard} period={period} />
                </>
            )}
        </div>
    );
}
