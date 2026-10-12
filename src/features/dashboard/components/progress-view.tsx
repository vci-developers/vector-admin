'use client';

import { useGetCoverage } from '@/api/coverage/hooks/use-get-coverage';
import { useGetProgress } from '@/api/progress/hooks/use-get-progress';
import type { ProgressDashboard } from '@/api/progress/validation/progress-schema';
import { Button } from '@/components/ui/button';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { AvailableProgramsContext } from './dashboard-provider';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import { buildUpcomingAreas } from '@/features/dashboard/utils/build-upcoming-areas';
import { programTitle } from '@/features/dashboard/utils/program-title';
import {
    PROGRESS_SCAN_FILL_OPACITY,
    PROGRESS_SCAN_LEGEND,
} from '@/features/dashboard/utils/progress-map-colors';
import type { ProgressMapPlacement } from '@/features/dashboard/utils/match-progress-district-boundaries';
import {
    isInProgress,
    resolveReportingRange,
} from '@/features/dashboard/utils/resolve-reporting-range';
import { cn } from '@/utils/cn';
import {
    AlertCircle,
    Bug,
    Download,
    Loader2,
    MapPin,
    ScanLine,
    X,
} from 'lucide-react';
import { useFormatter } from 'next-intl';
import dynamic from 'next/dynamic';
import { parseAsString, useQueryState } from 'nuqs';
import { use, useEffect, useMemo, useState } from 'react';
import PeriodPicker from './period-picker';
import ProgressAreaPicker from './progress-area-picker';
import ProgressCoverageHeadline from './progress-coverage-headline';
import ProgressLoading from './progress-loading';
import ProgressMonthlyChart from './progress-monthly-chart';
import ProgressProgramPicker from './progress-program-picker';
import ProgressSpeciesBreakdown from './progress-species-breakdown';
import ProgressCountHeadline from './progress-count-headline';
import styles from './progress-view.module.css';

const ProgressMap = dynamic(() => import('./progress-map'), {
    ssr: false,
    loading: () => (
        <div
            role="status"
            className="bg-muted flex h-full items-center justify-center gap-2 text-sm text-neutral-500"
        >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading map…
        </div>
    ),
});

export default function ProgressView() {
    const formatter = useFormatter();
    const periodLabel = usePeriodLabel();
    const [filters, setFilters] = useDashboardFilters();
    const initialPrograms = use(AvailableProgramsContext);
    const [districtKey, setDistrictKey] = useQueryState(
        'district',
        parseAsString,
    );
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [mapPlacement, setMapPlacement] =
        useState<ProgressMapPlacement | null>(null);
    const { range, currentMonth } = useMemo(() => {
        const now = new Date();
        return {
            range: resolveReportingRange(
                filters.range,
                { from: filters.from, to: filters.to },
                now,
            ),
            currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }, [filters.range, filters.from, filters.to]);
    const query = useGetProgress({ exclude: filters.exclude, ...range });
    const result = query.data;
    const dashboard: ProgressDashboard | null = result?.ok ? result.data : null;
    const [showUpcoming, setShowUpcoming] = useState(false);
    // The tiles share rows, so they open and close together.
    const [tilesExpanded, setTilesExpanded] = useState(false);
    const toggleTiles = () => setTilesExpanded(open => !open);
    const coverage = useGetCoverage(filters.exclude).data;
    const upcoming = useMemo(
        () =>
            coverage?.ok && dashboard
                ? buildUpcomingAreas(
                      coverage.data,
                      new Set(
                          dashboard.districts.map(district => district.key),
                      ),
                  )
                : [],
        [coverage, dashboard],
    );
    const selected = dashboard?.districts.find(
        district => district.key === districtKey,
    );
    const selectedKey = selected?.key ?? null;
    const programs = dashboard?.programs ?? initialPrograms;
    const offeredPrograms = programs.filter(
        program => !HIDDEN_BY_DEFAULT_PROGRAM_IDS.includes(program.programId),
    );
    const chosenPrograms =
        dashboard?.programs.filter(program =>
            dashboard.selectedProgramIds.includes(program.programId),
        ) ?? [];
    const chosenCountries = Array.from(
        new Set(chosenPrograms.map(program => program.country)),
    );
    const scope =
        selected?.name ??
        (chosenCountries.length === 1
            ? chosenCountries[0]
            : 'All selected countries');
    const label = dashboard
        ? periodLabel(dashboard.from, dashboard.to)
        : range.from
          ? periodLabel(range.from, range.to)
          : 'All time';
    const byProgram =
        selected?.scansByProgram ?? dashboard?.scansByProgram ?? [];
    const partial = (dashboard?.failedProgramIds.length ?? 0) > 0;
    const unavailable = dashboard !== null && dashboard.uniqueScans === null;
    const noSelection = dashboard?.selectedProgramIds.length === 0;
    const updating = query.isPlaceholderData;
    const unplaced =
        mapPlacement?.source === dashboard?.districts
            ? (mapPlacement?.unplaced ?? [])
            : [];
    const failedNames =
        dashboard?.programs
            .filter(program =>
                dashboard.failedProgramIds.includes(program.programId),
            )
            .map(programTitle) ?? [];

    useEffect(() => {
        if (dashboard && !updating && districtKey && !selected) {
            void setDistrictKey(null);
        }
    }, [dashboard, updating, districtKey, selected, setDistrictKey]);

    function choosePrograms(selectedProgramIds: number[]) {
        const selectedIds = new Set(selectedProgramIds);
        void setDistrictKey(null);
        void setFilters({
            exclude: programs
                .filter(program => !selectedIds.has(program.programId))
                .map(program => program.programId),
        });
    }

    async function downloadWorkbook() {
        setExporting(true);
        setExportError(null);
        try {
            const params = new URLSearchParams({
                exclude: filters.exclude.join(','),
                to: range.to,
                ...(range.from ? { from: range.from } : {}),
            });
            const response = await fetch(`/api/progress/report?${params}`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Report unavailable');
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `VectorCam-progress-${dashboard?.from ?? 'all'}-${range.to}.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            setExportError(
                'Could not download the workbook. Please try again.',
            );
        } finally {
            setExporting(false);
        }
    }

    return (
        <div
            className={cn(
                'progress-dashboard space-y-5 sm:space-y-6',
                styles.dashboard,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
                <div className="shrink-0">
                    <p className="text-primary mb-2 text-[11px] font-semibold tracking-[0.16em] uppercase">
                        Field surveillance
                    </p>
                    <h1 className={styles.heading}>VectorCam in the field</h1>
                </div>
                <div className={styles.filters}>
                    <div className="min-w-0">
                        <ProgressProgramPicker
                            programs={offeredPrograms}
                            excludedProgramIds={filters.exclude}
                            onChange={choosePrograms}
                        />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-muted-foreground text-[11px] font-medium">
                            Reporting period
                        </span>
                        <PeriodPicker
                            range={range}
                            currentMonth={currentMonth}
                            className={styles.periodFilter}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-base sm:text-lg">
                    <span className="text-foreground font-semibold">
                        {dashboard ? scope : 'Reporting overview'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium whitespace-nowrap">
                        {label}
                    </span>
                    {dashboard && isInProgress(dashboard.to, currentMonth) && (
                        <span className="bg-primary/8 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                            Current month in progress
                        </span>
                    )}
                    {selected && (
                        <button
                            type="button"
                            onClick={() => void setDistrictKey(null)}
                            className="text-primary focus-visible:ring-ring ml-1 inline-flex items-center gap-1 rounded py-1 text-xs outline-none hover:underline focus-visible:ring-2"
                        >
                            <X className="size-3" aria-hidden="true" />
                            Clear area
                        </button>
                    )}
                </p>
                {(dashboard?.lastUpdatedAt || updating) && (
                    <p
                        role={updating ? 'status' : undefined}
                        className="text-muted-foreground flex items-center gap-1.5"
                    >
                        {updating && (
                            <Loader2
                                className="size-3 animate-spin"
                                aria-hidden="true"
                            />
                        )}
                        {updating
                            ? 'Updating selection…'
                            : dashboard?.lastUpdatedAt
                              ? `Updated ${formatter.dateTime(dashboard.lastUpdatedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                              : null}
                    </p>
                )}
            </div>

            {!result ? (
                <ProgressLoading />
            ) : !result.ok ? (
                <div role="alert" className="bg-card rounded-2xl border p-8">
                    <AlertCircle
                        className="text-destructive mb-3 size-6"
                        aria-hidden="true"
                    />
                    <h2 className="font-semibold">
                        Reporting data is unavailable
                    </h2>
                    <p className="text-muted-foreground mt-2 max-w-lg text-sm">
                        We couldn’t connect to VectorCam. Please try loading the
                        data again.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => void query.refetch()}
                    >
                        Try again
                    </Button>
                </div>
            ) : (
                <div
                    aria-busy={updating}
                    className={cn(
                        'space-y-5 transition-opacity sm:space-y-6',
                        updating && 'pointer-events-none opacity-50',
                    )}
                >
                    {partial && (
                        <div
                            role="alert"
                            className="border-warning/30 bg-warning/5 text-warning flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
                        >
                            <AlertCircle
                                className="mt-0.5 size-4 shrink-0"
                                aria-hidden="true"
                            />
                            <p>
                                {unavailable
                                    ? 'Reporting data is unavailable.'
                                    : 'These figures are incomplete.'}{' '}
                                We couldn’t load {failedNames.join(', ')}.{' '}
                                {unavailable
                                    ? 'No totals are displayed until the data is available.'
                                    : 'Totals include the programs that loaded successfully.'}
                            </p>
                        </div>
                    )}
                    {noSelection && (
                        <p
                            role="status"
                            className="text-muted-foreground rounded-xl border p-4 text-sm"
                        >
                            No programs selected. Choose a program to show its
                            reporting data.
                        </p>
                    )}
                    <div className={styles.headlineCards}>
                        <ProgressCoverageHeadline
                            coverage={
                                selected
                                    ? selected.coverageByProgram
                                    : result.data.coverageByProgram
                            }
                            programs={result.data.programs}
                            expanded={tilesExpanded}
                            onToggle={toggleTiles}
                        />
                        <ProgressCountHeadline
                            title="Total Scans"
                            icon={ScanLine}
                            tone="mid"
                            total={
                                selected?.uniqueScans ?? result.data.uniqueScans
                            }
                            byProgram={byProgram.map(row => ({
                                programId: row.programId,
                                count: row.scans,
                            }))}
                            totalUnit="total scans"
                            singleUnit="images captured with VectorCam"
                            description="One image is one scan. A specimen with two images contributes two scans."
                            programs={result.data.programs}
                            expanded={tilesExpanded}
                            onToggle={toggleTiles}
                        />
                        <ProgressCountHeadline
                            title="Unique Specimens"
                            icon={Bug}
                            tone="dark"
                            total={
                                selected?.uniqueSpecimens ??
                                result.data.uniqueSpecimens
                            }
                            byProgram={byProgram.map(row => ({
                                programId: row.programId,
                                count: row.specimens,
                            }))}
                            totalUnit="total specimens"
                            singleUnit="specimens photographed"
                            description="Each specimen counts once. A specimen with two images counts a single time."
                            programs={result.data.programs}
                            expanded={tilesExpanded}
                            onToggle={toggleTiles}
                        />
                    </div>

                    <div className={styles.visuals}>
                        <section
                            aria-labelledby="progress-map-heading"
                            className={cn(
                                styles.panel,
                                'flex flex-col overflow-hidden',
                            )}
                        >
                            <div className="px-5 py-5 sm:px-7 sm:py-6">
                                <div className="flex items-start justify-between gap-4">
                                    <h2
                                        id="progress-map-heading"
                                        className={styles.panelHeading}
                                    >
                                        Where we’re receiving data
                                    </h2>
                                    <span className={styles.activityBadge}>
                                        <span className="bg-primary size-1.5 rounded-full" />
                                        Reported activity
                                    </span>
                                </div>
                                <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-[13px]">
                                    Collections reported during the selected
                                    period.
                                </p>
                            </div>
                            <div className={styles.mapCanvas}>
                                {result.data.districts.length > 0 ? (
                                    <ProgressMap
                                        districts={result.data.districts}
                                        upcoming={showUpcoming ? upcoming : []}
                                        selectedKey={selectedKey}
                                        onSelect={key =>
                                            void setDistrictKey(key)
                                        }
                                        onPlacementChange={setMapPlacement}
                                    />
                                ) : (
                                    <div className="bg-muted/60 flex h-full flex-col items-center justify-center px-6 text-center">
                                        <MapPin
                                            className="text-primary/60 mb-3 size-8"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm font-medium">
                                            {unavailable
                                                ? 'Map data unavailable'
                                                : result.data.districts.length >
                                                    0
                                                  ? 'Map locations unavailable'
                                                  : 'No reporting locations in this period'}
                                        </p>
                                        <p className="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed">
                                            {result.data.districts.length > 0
                                                ? 'Reporting totals are still included. Choose an area beside the chart to see its activity.'
                                                : 'Try another reporting period or country.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-7">
                                <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
                                    <span
                                        aria-hidden="true"
                                        className="flex items-end gap-1.5"
                                    >
                                        <span
                                            className="h-3 w-14 rounded-sm"
                                            style={{
                                                background:
                                                    PROGRESS_SCAN_LEGEND,
                                                opacity:
                                                    PROGRESS_SCAN_FILL_OPACITY,
                                            }}
                                        />
                                    </span>
                                    Darker shade = more scans
                                </p>
                                <div className="text-muted-foreground inline-flex max-w-full items-center gap-2.5 text-[11px]">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={showUpcoming}
                                        aria-labelledby="progress-target-toggle-label"
                                        onClick={() =>
                                            setShowUpcoming(shown => !shown)
                                        }
                                        className={cn(
                                            'focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-2',
                                            showUpcoming
                                                ? 'bg-primary border-primary'
                                                : 'bg-muted',
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'bg-card absolute top-0.5 left-0.5 size-3.5 rounded-full shadow-xs transition-transform',
                                                showUpcoming && 'translate-x-4',
                                            )}
                                        />
                                    </button>
                                    <span
                                        id="progress-target-toggle-label"
                                        className="min-w-0 leading-snug"
                                    >
                                        Show upcoming locations
                                    </span>
                                </div>
                            </div>
                            <p className="text-muted-foreground border-t px-5 py-3 text-[11px] leading-relaxed sm:px-7">
                                Select an area to see its reporting locations
                                and scans.
                            </p>
                            {unplaced.length > 0 && (
                                <p className="text-muted-foreground border-t px-5 py-3 text-[11px] leading-relaxed sm:px-6">
                                    Not mapped:{' '}
                                    {unplaced
                                        .map(
                                            area =>
                                                `${area.key.endsWith(':unknown') ? 'Area not recorded' : area.name} (${area.country})`,
                                        )
                                        .join('; ')}
                                    . Counts are included.
                                </p>
                            )}
                        </section>

                        <section
                            aria-labelledby="progress-chart-heading"
                            className={cn(
                                styles.panel,
                                styles.chartPanel,
                                'flex min-h-0 flex-col p-5 sm:p-7',
                            )}
                        >
                            <div className="flex flex-col gap-5">
                                <div>
                                    <h2
                                        id="progress-chart-heading"
                                        className={styles.panelHeading}
                                    >
                                        Scans per month
                                    </h2>
                                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-[13px]">
                                        By collection month.
                                    </p>
                                </div>
                                <div className="w-full">
                                    <ProgressAreaPicker
                                        areas={result.data.districts}
                                        showCountry={chosenCountries.length > 1}
                                        selectedKey={selectedKey}
                                        onChange={key =>
                                            void setDistrictKey(key)
                                        }
                                        disabled={
                                            unavailable ||
                                            noSelection ||
                                            updating
                                        }
                                    />
                                </div>
                            </div>
                            {unavailable || noSelection ? (
                                <div className="text-muted-foreground flex min-h-[300px] flex-1 items-center justify-center text-sm">
                                    Monthly data unavailable
                                </div>
                            ) : (
                                <div className="mt-6 min-w-0 shrink-0">
                                    <ProgressMonthlyChart
                                        months={
                                            selected?.monthly ??
                                            result.data.monthly
                                        }
                                    />
                                </div>
                            )}
                            {!unavailable && !noSelection && (
                                <ProgressSpeciesBreakdown
                                    species={
                                        selected?.species ?? result.data.species
                                    }
                                    areaName={selected?.name ?? null}
                                />
                            )}
                        </section>
                    </div>

                    <footer className="text-muted-foreground flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-t pt-5 text-xs">
                        <div className="max-w-2xl space-y-2">
                            <details className="text-[11px]">
                                <summary className="hover:text-foreground focus-visible:ring-ring w-fit cursor-pointer rounded py-1 outline-none focus-visible:ring-2">
                                    How these figures are counted
                                </summary>
                                <div className="mt-2 max-w-xl space-y-2 leading-relaxed">
                                    <p>
                                        Coverage counts the distinct reporting
                                        unit used by each program, such as
                                        households, municipalities or health
                                        districts. A unit is active when it
                                        submitted at least one surveillance
                                        collection in the selected period,
                                        including collections with no specimens.
                                        Repeat visits to the same unit count
                                        once. Each program’s reporting unit is
                                        shown beside its count.
                                    </p>
                                    <p>
                                        One image is one scan. A specimen with
                                        two images contributes two scans. Months
                                        use the collection date in the program’s
                                        reporting time zone, falling back to the
                                        upload date when a collection date is
                                        missing.
                                    </p>
                                    <p>
                                        Shading identifies areas with reporting
                                        sites in the selected period; it does
                                        not mean every part of a reporting area
                                        has been sampled. Where boundaries are
                                        unavailable, points summarize reporting
                                        activity. Rollout targets are kept
                                        separate from observed data.
                                    </p>
                                </div>
                            </details>
                        </div>
                        <div className="flex flex-col items-start gap-1.5 sm:items-end">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                    exporting ||
                                    partial ||
                                    unavailable ||
                                    noSelection ||
                                    updating
                                }
                                onClick={() => void downloadWorkbook()}
                                className="bg-card h-9 rounded-lg text-xs"
                            >
                                {exporting ? (
                                    <Loader2
                                        className="size-3.5 animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Download
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                )}
                                Download Excel
                            </Button>
                            <p className="text-[10px]">
                                All areas · Monthly actuals and separate targets
                            </p>
                            {exportError && (
                                <p
                                    role="alert"
                                    className="text-destructive max-w-xs text-xs"
                                >
                                    {exportError}
                                </p>
                            )}
                        </div>
                    </footer>
                </div>
            )}
        </div>
    );
}
