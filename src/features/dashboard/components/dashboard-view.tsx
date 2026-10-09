'use client';

import { useGetCoverage } from '@/api/coverage/hooks/use-get-coverage';
import type { CoverageDto } from '@/api/coverage/validation/coverage-schema';
import { useGetDashboard } from '@/api/dashboard/hooks/use-get-dashboard';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import { programTitle } from '@/features/dashboard/utils/program-title';
import {
    isInProgress,
    resolveReportingRange,
} from '@/features/dashboard/utils/resolve-reporting-range';
import type { ViewAs } from '@/lib/auth-session/viewer';
import { cn } from '@/utils/cn';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import CoverageMapPreview from './coverage-map-preview';
import CoverageTiles from './coverage-tiles';
import DashboardSkeleton from './dashboard-skeleton';
import InProgressInfo from './in-progress-info';
import MapSection from './map-section';
import PeriodSummary from './period-summary';
import ProgramFilter from './program-filter';
import PeriodPicker from './period-picker';
import RefreshControl from './refresh-control';
import SessionFilter from './session-filter';
import UsersSection from './users-section';

function currentMonthKey(now: Date) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardView({
    view,
}: {
    /** Which page this viewer gets, known before any data arrives. */
    view: ViewAs;
}) {
    const t = useTranslations('Dashboard');
    const tSummary = useTranslations('Summary');
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
        types: filters.types,
        testSites: filters.testSites,
        ...range,
    });
    const result = dashboardQuery.data;
    // Coverage comes from its own route and lands well before the Sessions.
    const coverageQuery = useGetCoverage(filters.exclude);
    const coverageResult = coverageQuery.data;
    const coverage: CoverageDto | null = !coverageResult
        ? null
        : coverageResult.ok
          ? coverageResult.data.coverage
          : { ok: false, error: t('coverageLoadError') };
    const outlines = coverageResult?.ok ? coverageResult.data.outlines : [];

    if (!result) {
        const showFills =
            filters.layers.includes('coverage') && coverage?.ok === true;
        return (
            <DashboardSkeleton
                message={t('loading')}
                // A Stakeholder never gets the activity cards.
                activityCards={view === 'developer'}
                coverageCardsFirst={view === 'stakeholder'}
                map={
                    showFills ? (
                        <CoverageMapPreview
                            fills={coverage.data.fills}
                            outlines={outlines}
                        />
                    ) : undefined
                }
                coverageCards={
                    coverageResult?.ok ? (
                        <CoverageTiles
                            coverage={coverage}
                            // Users come with the Sessions, still loading.
                            userCoverage={null}
                            programs={coverageResult.data.programs}
                            // A Stakeholder's sit in one row with the headline tiles.
                            asCells={view === 'stakeholder'}
                        />
                    ) : undefined
                }
            />
        );
    }
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
    // Stakeholders get the map and the summary cards; the server already
    // withholds the rest.
    const isDeveloper = dashboard.viewer === 'developer';
    const { from, to } = dashboard.metrics;
    const period = {
        from,
        to,
        label: periodLabel(from, to),
        inProgress: isInProgress(to, currentMonth),
    };
    // A filter change keeps the old numbers up until the new ones land; dim
    // them so they never pass for the new selection.
    const isUpdating =
        dashboardQuery.isPlaceholderData || coverageQuery.isPlaceholderData;
    const summary = (
        <PeriodSummary
            key={`summary-${from}:${to}`}
            dashboard={dashboard}
            coverage={coverage}
            period={period}
        />
    );
    const failedNames = dashboard.programs
        .filter(program =>
            dashboard.failedProgramIds.includes(program.programId),
        )
        .map(programTitle);

    return (
        // Stakeholders' page fits the window on wide screens: tighter gaps,
        // and the map stretches to fill what is left (see MapSection).
        <div
            className={cn(
                'flex flex-col',
                isDeveloper ? 'gap-8' : 'gap-4 lg:flex-1',
            )}
        >
            {/* Above the tables' sticky headers (up to z-20), below popovers
                and the session sheet (z-50). */}
            <div className="bg-background/95 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:sticky sm:top-0 sm:-mx-6 sm:px-6">
                {/* Stakeholders' summary heading lives here, left of the
                    filters, so the tiles start right below. */}
                {!isDeveloper && (
                    <div className="flex items-center gap-2">
                        <h2
                            id="summary-heading"
                            className="text-lg font-semibold"
                        >
                            {tSummary('heading', { period: period.label })}
                        </h2>
                        {period.inProgress && <InProgressInfo to={period.to} />}
                    </div>
                )}
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
                    <ProgramFilter programs={dashboard.programs} />
                    <SessionFilter />
                    <PeriodPicker range={range} currentMonth={currentMonth} />
                    {isUpdating && (
                        <span
                            role="status"
                            className="text-muted-foreground flex items-center gap-1.5 text-sm"
                        >
                            <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden="true"
                            />
                            {t('updating')}
                        </span>
                    )}
                </div>
                {isDeveloper && (
                    <RefreshControl
                        lastUpdatedAt={dashboard.lastUpdatedAt}
                        programIds={dashboard.selectedProgramIds}
                        // A filter change is "Updating", not a refresh.
                        isRefetching={
                            dashboardQuery.isFetching &&
                            !dashboardQuery.isPlaceholderData
                        }
                    />
                )}
            </div>
            <div
                aria-busy={isUpdating}
                className={cn(
                    'flex flex-col transition-opacity',
                    isDeveloper ? 'gap-8' : 'gap-4 lg:flex-1',
                    isUpdating && 'opacity-50',
                )}
            >
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
                        {/* Stakeholders read the summary tiles first; the
                            map is the drill-down. */}
                        {!isDeveloper && summary}
                        <MapSection
                            key={`${from}:${to}`}
                            dashboard={dashboard}
                            coverage={coverage}
                            outlines={outlines}
                            period={period}
                        />
                        {isDeveloper && summary}
                        {isDeveloper && (
                            <UsersSection
                                dashboard={dashboard}
                                period={period}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
