'use client';

import { useGetCoverage } from '@/api/coverage/hooks/use-get-coverage';
import { useGetProgress } from '@/api/progress/hooks/use-get-progress';
import type { ProgressDashboard } from '@/api/progress/validation/progress-schema';
import { Button } from '@/components/ui/button';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import {
    AvailableProgramsContext,
    DefaultExcludeContext,
} from './dashboard-provider';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import {
    countriesStartedBy,
    districtsAsOf,
    scansAsOf,
    speciesAsOf,
    timelineFigures,
} from '@/features/dashboard/utils/scans-as-of';
import { createTimelineClock } from '@/features/dashboard/utils/timeline-clock';
import { buildUpcomingAreas } from '@/features/dashboard/utils/build-upcoming-areas';
import {
    buildSpeciesMonths,
    colorSpeciesSeries,
    seriesKeyOf,
} from '@/features/dashboard/utils/build-species-months';
import { detectsStephensi } from '@/features/dashboard/utils/deployed-models';
import {
    isStephensi,
    STEPHENSI_LABEL,
    stephensiTimelineFigures,
    sumStephensiByDistrict,
    sumStephensiMonths,
} from '@/features/dashboard/utils/stephensi-totals';
import { programTitle } from '@/features/dashboard/utils/program-title';
import {
    PROGRESS_SCAN_FILL_OPACITY,
    PROGRESS_SCAN_LEGEND,
    PROGRESS_STEPHENSI_LEGEND,
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
    ArrowLeft,
    Globe,
    Loader2,
    MapPin,
    ScanLine,
    X,
} from 'lucide-react';
import { useFormatter } from 'next-intl';
import dynamic from 'next/dynamic';
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs';
import { use, useEffect, useMemo, useState, type ReactNode } from 'react';
import PeriodPicker from './period-picker';
import ProgramBreakdown from './program-breakdown';
import ProgressAreaPicker from './progress-area-picker';
import ProgressCoverageHeadline from './progress-coverage-headline';
import ProgressLoading from './progress-loading';
import ProgressMapTimeline from './progress-map-timeline';
import ProgressMonthlyChart from './progress-monthly-chart';
import ProgressPlaybackSummary from './progress-playback-summary';
import ProgressProgramPicker from './progress-program-picker';
import ProgressSpeciesBreakdown from './progress-species-breakdown';
import ProgressSpeciesToggle from './progress-species-toggle';
import ProgressStephensiPlaces from './progress-stephensi-places';
import ProgressMapFilters from './progress-map-filters';
import ProgressCountHeadline from './progress-count-headline';
import {
    activeDevicesByCountry,
    showsDeviceTarget,
} from '@/features/dashboard/utils/build-progress-devices';
import { addMonths } from '@/features/dashboard/utils/month-key';
import {
    specimensByPlace,
    speciesSpecimensByDistrict,
    speciesTimelineFigures,
} from '@/features/dashboard/utils/species-timeline';
import {
    scansInMonthByDistrict,
    speciesInMonthByDistrict,
    stephensiInMonthByDistrict,
} from '@/features/dashboard/utils/month-counts';
import {
    previousMapView,
    pushMapView,
    type MapView,
} from '@/features/dashboard/utils/map-view-trail';
import ProgressDevicesTile from './progress-devices-tile';
import ProgressStatTile from './progress-stat-tile';
import TaxonName from './taxon-name';
import ProgressSpeciesPlaces from './progress-species-places';
import styles from './progress-view.module.css';

const STEPHENSI_UNIT = (
    <>
        <i>An. stephensi</i> specimens
    </>
);

/** The timeline's stephensi bars: one series, so they grow like the scans. */
const STEPHENSI_SERIES = [
    {
        key: STEPHENSI_LABEL,
        name: STEPHENSI_LABEL,
        stephensi: true,
        color: 'var(--progress-stephensi)',
    },
];

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
    // A country clicked on the map narrows the picked Programs to its own.
    const [country, setCountry] = useQueryState('country', parseAsString);
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
    const exclude = country
        ? Array.from(
              new Set([
                  ...filters.exclude,
                  ...initialPrograms
                      .filter(program => program.country !== country)
                      .map(program => program.programId),
              ]),
          )
        : filters.exclude;
    const query = useGetProgress({ exclude, ...range });
    const withDeviceTarget = showsDeviceTarget(
        range,
        addMonths(currentMonth, -1),
    );
    const result = query.data;
    const dashboard: ProgressDashboard | null = result?.ok ? result.data : null;
    const [showUpcoming, setShowUpcoming] = useState(false);
    const [showStephensi, setShowStephensi] = useQueryState(
        'stephensi',
        parseAsBoolean.withDefault(false),
    );
    // The tiles share rows, so they open and close together.
    const [tilesExpanded, setTilesExpanded] = useState(false);
    const toggleTiles = () => setTilesExpanded(open => !open);
    const [statsExpanded, setStatsExpanded] = useState(false);
    const [asOf, setAsOf] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    // Opens on the first move of the timeline, and stays open at the end.
    const [playbackOpen, setPlaybackOpen] = useState(false);
    const [clock] = useState(createTimelineClock);
    const toggleStats = () => setStatsExpanded(open => !open);
    const coverage = useGetCoverage(exclude).data;
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
    const canShowStephensi =
        (dashboard?.stephensi.length ?? 0) > 0 ||
        chosenPrograms.some(detectsStephensi);
    const stephensiOn = showStephensi && canShowStephensi;
    // Programs narrowed below the default count as a place to return from.
    const defaultExclude = use(DefaultExcludeContext);
    const programsNarrowed = filters.exclude.some(
        id => !defaultExclude.includes(id),
    );
    // The stephensi filter, or its row, swaps the chart panel to stephensi only.
    // Opens on stephensi when the page loads with its filter on.
    const [stephensiFocus, setStephensiFocus] = useState(showStephensi);
    const stephensiFocused = stephensiOn && stephensiFocus;
    // Specimens per species per month, split inside each scan bar.
    const speciesMonths = useMemo(() => {
        if (!dashboard) return null;
        const area = dashboard.districts.find(row => row.key === districtKey);
        const months = area?.monthly ?? dashboard.monthly;
        const species = buildSpeciesMonths(
            area ? [area] : dashboard.districts,
            months.map(row => row.month),
        );
        return {
            series: colorSpeciesSeries(species.series),
            months: months.map((row, index) => ({
                month: row.month,
                count: row.uniqueScans,
                specimens: species.months[index].specimens,
            })),
        };
    }, [dashboard, districtKey]);
    const [focusedSpecies, setFocusedSpecies] = useState<string | null>(null);
    // A bar clicked in the chart: the map shows that month alone.
    const [pickedMonth, setPickedMonth] = useState<string | null>(null);
    // A bar clicked on the timeline: it pauses there, to look around.
    const jumpTimelineTo = (month: string | null) => {
        if (!month) return;
        setPlaying(false);
        setAsOf(month);
    };
    // The scans chart: on the timeline, bars grow in as it reaches each month.
    const scansChart = (upTo: string | null) =>
        speciesMonths && (
            <ProgressMonthlyChart
                months={speciesMonths.months}
                species={speciesMonths.series}
                focusedSpecies={focusedSpecies}
                upTo={upTo}
                compact={upTo !== null}
                selectedMonth={upTo === null ? pickedMonth : null}
                onMonthSelect={upTo === null ? setPickedMonth : jumpTimelineTo}
            />
        );
    // Any other selection, on the map or in the picker, returns to every species.
    const selectArea = (key: string | null) => {
        remember();
        void setDistrictKey(key);
        // An area picked straight from the world view (as the stephensi
        // filter allows) brings its country with it, so Return still shows.
        const area = dashboard?.districts.find(row => row.key === key);
        if (area && !country) void setCountry(area.country);
        // With the stephensi filter on, the panel stays on stephensi.
        setStephensiFocus(stephensiOn);
    };
    const chosenCountries = Array.from(
        new Set(chosenPrograms.map(program => program.country)),
    );
    // Countries and Programs that uploaded in the period, not just picked,
    // practice included as everywhere else: scans, or a site visited (as
    // Geographic Coverage counts). One that failed to load may have, so stays.
    const visitedSites = new Map(
        (dashboard?.sentinelSitesByProgram ?? []).map(row => [
            row.programId,
            row.count,
        ]),
    );
    const notReporting = new Set(
        (dashboard?.scansByProgram ?? [])
            .filter(
                row =>
                    row.scans === 0 &&
                    (visitedSites.get(row.programId) ?? 0) === 0,
            )
            .map(row => row.programId),
    );
    const reportingPrograms = chosenPrograms.filter(
        program => !notReporting.has(program.programId),
    );
    const shownCountries = selected
        ? [selected.country]
        : Array.from(
              new Set(reportingPrograms.map(program => program.country)),
          );
    // Picked but silent in the period: listed last, greyed out.
    const silentPrograms = chosenPrograms.filter(program =>
        notReporting.has(program.programId),
    );
    const shownPrograms = selected
        ? reportingPrograms.filter(program =>
              selected.programIds.includes(program.programId),
          )
        : [...reportingPrograms, ...silentPrograms];
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
    // The month the map is showing; null is the whole period.
    const shownMonth = dashboard?.monthly.some(row => row.month === asOf)
        ? asOf
        : null;
    const stephensiCounts = useMemo(
        () => sumStephensiByDistrict(dashboard?.stephensi ?? [], shownMonth),
        [dashboard, shownMonth],
    );
    const summaryMonth = playbackOpen
        ? (shownMonth ?? dashboard?.monthly.at(-1)?.month ?? null)
        : null;
    // Stays on the last month at the end of a run, so colours don't jump back.
    const mapScans = useMemo(
        () => scansAsOf(dashboard?.districts ?? [], summaryMonth ?? shownMonth),
        [dashboard, summaryMonth, shownMonth],
    );
    // On the timeline, the tags count sites and devices up to the month.
    const mapDistricts = useMemo(
        () =>
            districtsAsOf(
                dashboard?.districts ?? [],
                summaryMonth ?? shownMonth,
            ),
        [dashboard, summaryMonth, shownMonth],
    );
    // On the timeline, countries stay faint until their first upload.
    const startedCountries = useMemo(
        () =>
            countriesStartedBy(
                dashboard?.districts ?? [],
                summaryMonth ?? shownMonth,
            ),
        [dashboard, summaryMonth, shownMonth],
    );
    const shownSpecies = useMemo(() => {
        const districts = dashboard?.districts ?? [];
        const area = districts.find(row => row.key === districtKey);
        return speciesAsOf(area ? [area] : districts, shownMonth);
    }, [dashboard, districtKey, shownMonth]);
    const stephensiTotals = useMemo(
        () => sumStephensiByDistrict(dashboard?.stephensi ?? []),
        [dashboard],
    );
    const stephensiHeat =
        stephensiOn && playbackOpen
            ? { counts: stephensiCounts, totals: stephensiTotals }
            : undefined;
    const summaryFigures = useMemo(() => {
        if (!summaryMonth || !dashboard) return null;
        const area = dashboard.districts.find(row => row.key === districtKey);
        return timelineFigures(
            area ? [area] : dashboard.districts,
            dashboard.monthly.map(row => row.month),
            summaryMonth,
        );
    }, [dashboard, districtKey, summaryMonth]);
    // With the stephensi filter on, the timeline panel follows the map:
    // stephensi alone.
    const stephensiSummary =
        summaryMonth && dashboard && stephensiOn
            ? stephensiTimelineFigures(
                  dashboard.stephensi,
                  dashboard.monthly.map(row => row.month),
                  summaryMonth,
                  districtKey,
                  new Map(
                      dashboard.programs.map(program => [
                          program.programId,
                          program.country,
                      ]),
                  ),
              )
            : null;
    // A species chosen in the breakdown: the timeline follows it alone, as it
    // does stephensi. The stephensi filter comes first.
    const playedSeries = stephensiSummary
        ? STEPHENSI_SERIES[0]
        : summaryMonth
          ? speciesMonths?.series.find(row => row.key === focusedSpecies)
          : undefined;
    const playFocus =
        playedSeries && summaryMonth && dashboard
            ? {
                  series: playedSeries,
                  stephensi: stephensiSummary !== null,
                  figures:
                      stephensiSummary ??
                      speciesTimelineFigures(
                          selected ? [selected] : dashboard.districts,
                          dashboard.monthly.map(row => row.month),
                          summaryMonth,
                          playedSeries.key,
                      ),
              }
            : null;
    // Its map: shaded by that species' specimens, the period's total setting
    // the scale. Not for stephensi, which has its own shading.
    // Built from state alone, so the map's areas keep their identity between
    // renders (a new list each render loops through the map's effects).
    // A chosen species shades the map by its specimens, playing or not; the
    // stephensi filter has its own shading.
    const speciesMapKey = stephensiOn ? null : focusedSpecies;
    const speciesTotals = useMemo(
        () =>
            speciesMapKey && dashboard
                ? speciesSpecimensByDistrict(
                      dashboard.districts,
                      speciesMapKey,
                      null,
                  )
                : null,
        [dashboard, speciesMapKey],
    );
    const speciesScans = useMemo(
        () =>
            speciesMapKey && dashboard
                ? speciesSpecimensByDistrict(
                      dashboard.districts,
                      speciesMapKey,
                      summaryMonth,
                  )
                : null,
        [dashboard, speciesMapKey, summaryMonth],
    );
    // The period's total sets the scale, so colours only deepen.
    const speciesDistricts = useMemo(
        () =>
            speciesTotals
                ? mapDistricts.map(row => ({
                      ...row,
                      uniqueScans: speciesTotals.get(row.key) ?? 0,
                  }))
                : null,
        [speciesTotals, mapDistricts],
    );
    const speciesMapSeries = speciesMonths?.series.find(
        row => row.key === speciesMapKey,
    );
    // Off the timeline, `scans` is the period's total: areas without the
    // species stay outlines, as on the timeline before it arrives.
    const speciesMap =
        speciesMapSeries && speciesScans && speciesDistricts
            ? {
                  scans: speciesScans,
                  districts: speciesDistricts,
                  unit: {
                      label: (
                          <>
                              <TaxonName name={speciesMapSeries.name} />{' '}
                              specimens
                          </>
                      ),
                      text: `${speciesMapSeries.name} specimens`,
                  },
              }
            : null;
    // A month picked in the chart, off the timeline: the map shows its counts
    // alone (scans, or the chosen species' or stephensi's specimens).
    const monthAlone =
        summaryMonth === null &&
        dashboard?.monthly.some(row => row.month === pickedMonth)
            ? pickedMonth
            : null;
    const monthSpeciesKey = speciesMapSeries?.key ?? null;
    const monthCounts = useMemo(() => {
        if (!monthAlone || !dashboard) return null;
        return monthSpeciesKey
            ? speciesInMonthByDistrict(
                  dashboard.districts,
                  monthSpeciesKey,
                  monthAlone,
              )
            : scansInMonthByDistrict(dashboard.districts, monthAlone);
    }, [dashboard, monthAlone, monthSpeciesKey]);
    // The month's own counts set the scale, so a quiet month still shows.
    const monthDistricts = useMemo(
        () =>
            monthCounts
                ? mapDistricts.map(row => ({
                      ...row,
                      uniqueScans: monthCounts.get(row.key) ?? 0,
                  }))
                : null,
        [monthCounts, mapDistricts],
    );
    const monthStephensiCounts = useMemo(
        () =>
            monthAlone && dashboard
                ? stephensiInMonthByDistrict(dashboard.stephensi, monthAlone)
                : null,
        [dashboard, monthAlone],
    );
    const monthStephensi = stephensiOn ? monthStephensiCounts : null;
    // Where the played species' specimens so far come from: by country, or by
    // area once a country or area is chosen.
    const placesByArea = country !== null || selected !== undefined;
    const playPlaces =
        playFocus && dashboard && summaryMonth
            ? specimensByPlace(
                  playFocus.stephensi
                      ? sumStephensiByDistrict(
                            dashboard.stephensi,
                            summaryMonth,
                        )
                      : speciesSpecimensByDistrict(
                            dashboard.districts,
                            playFocus.series.key,
                            summaryMonth,
                        ),
                  selected ? [selected] : dashboard.districts,
                  placesByArea ? 'area' : 'country',
              )
            : null;
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

    // The map's country and the Program picker stay in step: picking Programs
    // leaves the country, and choosing or leaving a country keeps the picks.
    function chooseCountry(next: string | null) {
        remember();
        void setDistrictKey(null);
        setStephensiFocus(stephensiOn);
        void setCountry(next);
    }

    // A species' timeline keeps the breakdown, with that species alone.
    function onlyPlayedSpecies<T extends { name: string | null }>(
        rows: readonly T[],
    ): readonly T[] {
        if (!playFocus) return rows;
        return playFocus.stephensi
            ? rows.filter(row => row.name !== null && isStephensi(row.name))
            : rows.filter(
                  row => seriesKeyOf(row.name) === playFocus.series.key,
              );
    }

    function closePlayback() {
        setPlaying(false);
        setAsOf(null);
        setPlaybackOpen(false);
    }

    // Each step into the map (a country, an area, Programs, the stephensi
    // filter) can be retraced by Back, or a click outside.
    const [trail, setTrail] = useState<MapView[]>([]);
    const currentView: MapView = {
        country,
        districtKey,
        stephensi: stephensiOn,
        exclude: programsNarrowed ? filters.exclude : null,
    };
    const back = previousMapView(trail, currentView);
    function remember() {
        setTrail(steps => pushMapView(steps, currentView));
    }
    function goBack() {
        setTrail(back.rest);
        if (!back.view) return;
        void setCountry(back.view.country);
        void setDistrictKey(back.view.districtKey);
        void setShowStephensi(back.view.stephensi);
        setStephensiFocus(back.view.stephensi);
        void setFilters({
            exclude: back.view.exclude ? [...back.view.exclude] : null,
        });
    }

    // So does the stephensi filter, which zooms to its areas alone.
    const canReturn = country !== null || programsNarrowed || stephensiOn;
    function returnToGlobal() {
        chooseCountry(null);
        if (programsNarrowed) void setFilters({ exclude: null });
        if (stephensiOn) {
            void setShowStephensi(false);
            setStephensiFocus(false);
        }
    }

    function choosePrograms(selectedProgramIds: number[]) {
        remember();
        const selectedIds = new Set(selectedProgramIds);
        void setDistrictKey(null);
        void setCountry(null);
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
                exclude: exclude.join(','),
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
                            excludedProgramIds={exclude}
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
                            onClick={() => selectArea(null)}
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
                    <div className={styles.statTiles}>
                        <ProgressStatTile
                            title="Countries"
                            icon={Globe}
                            value={shownCountries.length}
                            detail={
                                shownCountries.join(', ') ||
                                (shownPrograms.length > 0
                                    ? 'no data in this period'
                                    : 'Choose a program')
                            }
                            expanded={statsExpanded}
                            onToggle={toggleStats}
                        >
                            {shownPrograms.length > 1 && (
                                <ProgramBreakdown
                                    rows={shownPrograms}
                                    programs={
                                        new Map(
                                            shownPrograms.map(program => [
                                                program.programId,
                                                program,
                                            ]),
                                        )
                                    }
                                    label="Programs by country"
                                    tone="coverage"
                                    muted={program =>
                                        notReporting.has(program.programId)
                                    }
                                    figure={rows =>
                                        rows.every(row =>
                                            notReporting.has(row.programId),
                                        ) ? (
                                            <span
                                                className={styles.noPeriodData}
                                            >
                                                No data in this period
                                            </span>
                                        ) : null
                                    }
                                />
                            )}
                        </ProgressStatTile>
                        <ProgressDevicesTile
                            devices={result.data.devices}
                            selectedProgramIds={selected?.programIds ?? null}
                            withTarget={withDeviceTarget}
                            programs={result.data.programs}
                            expanded={statsExpanded}
                            onToggle={toggleStats}
                        />
                    </div>
                    <div className={styles.headlineCards}>
                        <ProgressCoverageHeadline
                            coverage={
                                selected
                                    ? selected.coverageByProgram
                                    : result.data.coverageByProgram
                            }
                            sentinelSites={
                                selected
                                    ? selected.sentinelSitesByProgram
                                    : result.data.sentinelSitesByProgram
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
                            <div className="px-5 py-5 sm:px-7 sm:py-6 xl:py-3">
                                <div className="flex items-center justify-between gap-4">
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
                                <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-[13px] xl:hidden">
                                    Collections reported during the selected
                                    period.
                                </p>
                            </div>
                            <div className={styles.mapCanvas}>
                                {result.data.districts.length > 0 && (
                                    <div className="absolute top-4 right-4 z-[1000]">
                                        <ProgressMapFilters
                                            stephensi={
                                                canShowStephensi
                                                    ? stephensiOn
                                                    : null
                                            }
                                            onStephensiChange={shown => {
                                                remember();
                                                void setShowStephensi(shown);
                                                // The panel follows the map: stephensi alone.
                                                setStephensiFocus(shown);
                                            }}
                                            upcoming={showUpcoming}
                                            onUpcomingChange={setShowUpcoming}
                                        />
                                    </div>
                                )}
                                {result.data.districts.length > 0 ? (
                                    <ProgressMap
                                        districts={
                                            monthDistricts ??
                                            speciesMap?.districts ??
                                            mapDistricts
                                        }
                                        scansAsOf={
                                            monthCounts ??
                                            speciesMap?.scans ??
                                            mapScans
                                        }
                                        countUnit={speciesMap?.unit}
                                        startedCountries={startedCountries}
                                        playing={playing && shownMonth !== null}
                                        timelineOpen={summaryFigures !== null}
                                        upcoming={showUpcoming ? upcoming : []}
                                        stephensi={
                                            stephensiOn && !summaryFigures
                                                ? (monthStephensi ??
                                                  stephensiCounts)
                                                : undefined
                                        }
                                        stephensiHeat={stephensiHeat}
                                        devices={activeDevicesByCountry(
                                            result.data.devices,
                                            result.data.programs,
                                            summaryMonth ?? shownMonth,
                                        )}
                                        selectedKey={selectedKey}
                                        onSelect={selectArea}
                                        selectedCountry={country}
                                        onCountrySelect={chooseCountry}
                                        // A click outside steps back only while
                                        // the map is narrowed; at the global
                                        // view there's nothing to leave, so it
                                        // never steps back into a country.
                                        onReturnToGlobal={
                                            canReturn
                                                ? back.view
                                                    ? goBack
                                                    : returnToGlobal
                                                : undefined
                                        }
                                        stephensiFocused={stephensiFocused}
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
                                {(back.view || canReturn) && (
                                    <div className={styles.mapNav}>
                                        {back.view && (
                                            <button
                                                type="button"
                                                onClick={goBack}
                                                className={styles.mapNavButton}
                                                aria-label="Back"
                                                data-label="Back"
                                            >
                                                <ArrowLeft
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        )}
                                        {canReturn && (
                                            <button
                                                type="button"
                                                onClick={returnToGlobal}
                                                className={styles.mapNavButton}
                                                aria-label="Return to global view"
                                                data-label="Global view"
                                            >
                                                <Globe
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        )}
                                    </div>
                                )}
                                {monthAlone && (
                                    <div
                                        role="status"
                                        className={styles.monthChip}
                                    >
                                        Showing{' '}
                                        <strong>
                                            {formatter.dateTime(
                                                new Date(
                                                    `${monthAlone}-01T00:00:00Z`,
                                                ),
                                                {
                                                    month: 'long',
                                                    year: 'numeric',
                                                    timeZone: 'UTC',
                                                },
                                            )}
                                        </strong>{' '}
                                        only
                                        <button
                                            type="button"
                                            onClick={() => setPickedMonth(null)}
                                            aria-label="Show the whole period"
                                        >
                                            <X
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        </button>
                                    </div>
                                )}
                                {result.data.monthly.length > 1 && (
                                    <ProgressMapTimeline
                                        months={result.data.monthly}
                                        month={shownMonth}
                                        onChange={month => {
                                            // The timeline takes over the map.
                                            setPickedMonth(null);
                                            setAsOf(month);
                                            setPlaybackOpen(true);
                                        }}
                                        playing={playing}
                                        // Stable: the timeline stops when it changes.
                                        onPlayingChange={setPlaying}
                                        clock={clock}
                                    />
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-7 xl:py-2.5">
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                    {/* The stephensi filter shades stephensi alone. */}
                                    {!stephensiOn && (
                                        <MapLegendSwatch
                                            background={PROGRESS_SCAN_LEGEND}
                                        >
                                            {/* One span: the swatch row spaces its children apart. */}
                                            <span>
                                                Darker shade = more{' '}
                                                {speciesMap
                                                    ? speciesMap.unit.label
                                                    : 'scans'}
                                            </span>
                                        </MapLegendSwatch>
                                    )}
                                    {stephensiOn && (
                                        <MapLegendSwatch
                                            background={
                                                PROGRESS_STEPHENSI_LEGEND
                                            }
                                        >
                                            More <i>An. stephensi</i>
                                        </MapLegendSwatch>
                                    )}
                                </div>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    Select an area to see its reporting
                                    locations and scans.
                                </p>
                            </div>
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
                                'flex min-h-0 flex-col p-5 sm:p-7 xl:p-5',
                            )}
                        >
                            {summaryFigures && playFocus ? (
                                <ProgressPlaybackSummary
                                    clock={clock}
                                    heading={
                                        <>
                                            <TaxonName
                                                name={
                                                    playFocus.stephensi
                                                        ? 'An. stephensi'
                                                        : playFocus.series.name
                                                }
                                            />{' '}
                                            specimens
                                        </>
                                    }
                                    title={scope}
                                    monthly={playFocus.figures.months.map(
                                        row => row.count,
                                    )}
                                    stats={[
                                        [
                                            'Specimens this month',
                                            playFocus.figures.added,
                                        ],
                                        [
                                            'Scans this month',
                                            summaryFigures.added,
                                        ],
                                        [
                                            'Areas found',
                                            playFocus.figures.areas,
                                        ],
                                        [
                                            'Countries',
                                            playFocus.figures.countries,
                                        ],
                                    ]}
                                    stephensi={playFocus.stephensi}
                                    playing={playing}
                                    chart={
                                        <ProgressMonthlyChart
                                            months={playFocus.figures.months.map(
                                                row => ({
                                                    ...row,
                                                    specimens: {
                                                        [playFocus.series.key]:
                                                            row.count,
                                                    },
                                                }),
                                            )}
                                            species={[playFocus.series]}
                                            seriesName={playFocus.series.name}
                                            unitLabel={
                                                playFocus.stephensi ? (
                                                    STEPHENSI_UNIT
                                                ) : (
                                                    <>
                                                        <TaxonName
                                                            name={
                                                                playFocus.series
                                                                    .name
                                                            }
                                                        />{' '}
                                                        specimens
                                                    </>
                                                )
                                            }
                                            upTo={summaryMonth}
                                            compact
                                            onMonthSelect={jumpTimelineTo}
                                        />
                                    }
                                    onClose={closePlayback}
                                />
                            ) : summaryFigures ? (
                                <ProgressPlaybackSummary
                                    clock={clock}
                                    heading="Total scans"
                                    title={scope}
                                    monthly={summaryFigures.months.map(
                                        row => row.scans,
                                    )}
                                    stats={[
                                        ['Specimens', summaryFigures.specimens],
                                        [
                                            'Scans this month',
                                            summaryFigures.added,
                                        ],
                                        [
                                            'Areas reporting',
                                            summaryFigures.areas,
                                        ],
                                        ['Countries', summaryFigures.countries],
                                    ]}
                                    playing={playing}
                                    chart={scansChart(summaryMonth)}
                                    onClose={closePlayback}
                                />
                            ) : (
                                <>
                                    <div className="flex flex-col gap-5 xl:gap-3">
                                        {/* No wrap: the toggle keeps its corner however long the title. */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h2
                                                    id="progress-chart-heading"
                                                    className={
                                                        styles.panelHeading
                                                    }
                                                >
                                                    {stephensiFocused ? (
                                                        <>
                                                            <span className="italic">
                                                                An. stephensi
                                                            </span>{' '}
                                                            per month
                                                        </>
                                                    ) : (
                                                        'Scans per month'
                                                    )}
                                                </h2>
                                                <p className="text-muted-foreground mt-2 text-xs leading-relaxed sm:text-[13px] xl:hidden">
                                                    {stephensiFocused
                                                        ? 'Specimens by submission month.'
                                                        : 'By submission month.'}
                                                </p>
                                            </div>
                                            {stephensiOn &&
                                                !unavailable &&
                                                !noSelection && (
                                                    <ProgressSpeciesToggle
                                                        stephensi={
                                                            stephensiFocused
                                                        }
                                                        onChange={
                                                            setStephensiFocus
                                                        }
                                                    />
                                                )}
                                        </div>
                                        <div className="w-full">
                                            <ProgressAreaPicker
                                                areas={result.data.districts}
                                                showCountry={
                                                    chosenCountries.length > 1
                                                }
                                                selectedKey={selectedKey}
                                                onChange={selectArea}
                                                allLabel={country ?? undefined}
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
                                        <div className="mt-6 min-w-0 shrink-0 xl:mt-2">
                                            {stephensiFocused ? (
                                                <ProgressMonthlyChart
                                                    months={sumStephensiMonths(
                                                        result.data.monthly.map(
                                                            row => row.month,
                                                        ),
                                                        result.data.stephensi,
                                                        selectedKey,
                                                    )}
                                                    seriesName="An. stephensi"
                                                    unitLabel={STEPHENSI_UNIT}
                                                    color="var(--progress-stephensi)"
                                                    selectedMonth={pickedMonth}
                                                    onMonthSelect={
                                                        setPickedMonth
                                                    }
                                                />
                                            ) : (
                                                scansChart(null)
                                            )}
                                        </div>
                                    )}
                                    {!unavailable &&
                                        !noSelection &&
                                        stephensiFocused && (
                                            <ProgressStephensiPlaces
                                                rows={result.data.stephensi}
                                                programs={result.data.programs}
                                                selectedKey={selectedKey}
                                                onSelect={key => {
                                                    remember();
                                                    void setDistrictKey(key);
                                                }}
                                            />
                                        )}
                                </>
                            )}
                            {!unavailable &&
                                !noSelection &&
                                (summaryFigures || !stephensiFocused) && (
                                    <ProgressSpeciesBreakdown
                                        species={onlyPlayedSpecies(
                                            shownSpecies ??
                                                selected?.species ??
                                                result.data.species,
                                        )}
                                        areaName={
                                            selected?.name ?? country ?? null
                                        }
                                        month={summaryMonth ?? shownMonth}
                                        barTotal={Math.max(
                                            1,
                                            ...onlyPlayedSpecies(
                                                selected?.species ??
                                                    result.data.species,
                                            ).map(row => row.specimens),
                                        )}
                                        onStephensiSelect={
                                            stephensiOn
                                                ? () => setStephensiFocus(true)
                                                : undefined
                                        }
                                        series={speciesMonths?.series}
                                        focusedSpecies={focusedSpecies}
                                        onFocusSpecies={setFocusedSpecies}
                                    />
                                )}
                            {playFocus && playPlaces && (
                                <ProgressSpeciesPlaces
                                    species={
                                        <TaxonName
                                            name={
                                                playFocus.stephensi
                                                    ? 'An. stephensi'
                                                    : playFocus.series.name
                                            }
                                        />
                                    }
                                    places={playPlaces}
                                    byArea={placesByArea}
                                    color={playFocus.series.color}
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
                                        use the date a collection was submitted,
                                        in the program’s reporting time zone.
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

function MapLegendSwatch({
    background,
    children,
}: {
    background: string;
    children: ReactNode;
}) {
    return (
        <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
            <span
                aria-hidden="true"
                className="h-3 w-14 rounded-sm"
                style={{ background, opacity: PROGRESS_SCAN_FILL_OPACITY }}
            />
            {children}
        </p>
    );
}
