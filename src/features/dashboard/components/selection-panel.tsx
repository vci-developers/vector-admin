'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    buildSelectionTimeline,
    type TimelineDimension,
} from '@/features/dashboard/utils/build-selection-timeline';
import {
    NOT_APPLICABLE,
    type SpecimenFacets,
} from '@/features/dashboard/utils/filter-map-points';
import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import { countCollectors } from '@/features/dashboard/utils/count-collectors';
import { programTitle } from '@/features/dashboard/utils/program-title';
import type { UserCoverageDto } from '@/api/dashboard/validation/dashboard-schema';
import type { LocationLevel } from '@/features/dashboard/utils/site-location-path';
import { ArrowLeft, Maximize2, Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DailyChartSheet from './daily-chart-sheet';
import SelectionChart, { CHART_VIEWS, type ChartView } from './selection-chart';
import SelectionList from './selection-list';
import LocationPath from './location-path';
import PanelTileFigures from './panel-tile-figures';
import type { SummarySession } from './specimen-summary';
import type { MapSelection } from './surveillance-map';

type PanelSession = SummarySession & {
    collectedAt: number;
    month: string;
    programId: number;
    siteId: number;
    collectorIds: number[];
    location: LocationLevel[];
};

const DIMENSIONS: TimelineDimension[] = ['species', 'sex', 'abdomen'];

type SelectionPanelProps = {
    selection: MapSelection;
    /** The Sessions drawn on the map, after the map filters. */
    sessions: PlacedSession[];
    devices: PlacedDevice[];
    sessionsByDevice: Map<number, PanelSession[]>;
    programs: Map<number, Program>;
    facets: SpecimenFacets;
    period: { from: string; to: string; label: string };
    /** No Site locations yet: what the panel would count is unknown. */
    loading: boolean;
    /** Sites still being geocoded; their Sessions join the counts later. */
    locatingCount: number;
    /** false for Stakeholders: the chart, never the Sessions behind it. */
    showSessions: boolean;
    /** The selected Programs: names the whole map ("Uganda"); with only one,
     * every selection is in it, so no Program line is shown. */
    scope: { title: string; single: boolean };
    /** Every Session the Session filter kept, whatever the map filters. */
    tileSessions: PanelSession[];
    userCoverage: UserCoverageDto[];
    onClear: () => void;
};

const rankingOf = (counts: Map<string, number>) =>
    [...counts].sort(([, a], [, b]) => b - a).map(([value]) => value);

/**
 * Specimens over time for whatever is clicked on the map, or the whole map
 * when nothing is; the Sessions or devices behind it are listed underneath.
 */
export default function SelectionPanel({
    selection,
    sessions,
    devices,
    sessionsByDevice,
    programs,
    facets,
    period,
    loading,
    locatingCount,
    showSessions,
    scope,
    tileSessions,
    userCoverage,
    onClear,
}: SelectionPanelProps) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const [dimension, setDimension] = useState<TimelineDimension>('species');
    // Temporary: lets us compare chart forms before settling on one.
    const [view, setView] = useState<ChartView>('bar');
    const [daily, setDaily] = useState(false);

    const selected = useMemo(() => {
        if (!selection)
            return { sessions, located: sessions, programIds: [] as number[] };
        const ids = new Set(selection.ids);
        if (selection.layer === 'specimens') {
            const picked = sessions.filter(s => ids.has(s.sessionId));
            return {
                sessions: picked,
                located: picked,
                programIds: [...new Set(picked.map(s => s.programId))],
            };
        }
        const picked = devices.filter(d => ids.has(d.deviceId));
        return {
            // A device reports everything it submitted, whatever the filters.
            sessions: picked.flatMap(
                d => sessionsByDevice.get(d.deviceId) ?? [],
            ),
            located: picked,
            programIds: [...new Set(picked.map(d => d.programId))],
        };
    }, [selection, sessions, devices, sessionsByDevice]);

    const periodLabel = period.label;
    // N/A is never a filter value, so it joins the ranking last.
    const ranking = useMemo(
        () =>
            dimension === 'species'
                ? rankingOf(facets[dimension])
                : [...rankingOf(facets[dimension]), NOT_APPLICABLE],
        [dimension, facets],
    );
    const timeline = useMemo(
        () =>
            buildSelectionTimeline({
                sessions: selected.sessions,
                period,
                dimension,
                ranking,
            }),
        [selected.sessions, period, dimension, ranking],
    );

    const unit = selection?.unit;
    const title = !selection
        ? scope.title
        : unit
          ? unit.unit
          : selection.layer === 'specimens'
            ? t('selectedSessions', { count: selection.ids.length })
            : t('selectedDevices', { count: selection.ids.length });
    // A unit names its Program even when nothing was collected there.
    const programLine = scope.single
        ? ''
        : (unit ? [unit.programId] : selected.programIds)
              .map(id => programs.get(id))
              .filter((p): p is Program => Boolean(p))
              .map(programTitle)
              .join(' · ');

    if (loading) {
        return (
            <div aria-busy="true" className="flex flex-col gap-3 px-4">
                <p role="status" className="sr-only">
                    {t('panelLoading')}
                </p>
                <Skeleton height="md" width="md" />
                <Skeleton height="lg" width="full" rounded="md" />
                <Skeleton className="mx-auto my-4 size-40 rounded-full" />
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} height="sm" width="full" />
                ))}
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {unit && (
                        <p className="text-xs">
                            {t('unitSummary', {
                                status: t(`coverageStatus.${unit.status}`),
                                sessions: selection.ids.length,
                            })}
                        </p>
                    )}
                    {programLine && (
                        <p className="text-muted-foreground truncate text-xs">
                            {programLine}
                        </p>
                    )}
                    {/* Stakeholders' counts come from the figures below. */}
                    <LocationPath
                        items={selected.located}
                        showCounts={showSessions}
                    />
                    {showSessions ? (
                        <p className="flex items-center gap-1 text-xs">
                            <Users
                                className="text-muted-foreground size-3 shrink-0"
                                aria-hidden="true"
                            />
                            {t('collectorCount', {
                                count: countCollectors(selected.sessions),
                            })}
                        </p>
                    ) : (
                        // Stakeholders: framed as the tiles are.
                        <PanelTileFigures
                            sessions={tileSessions}
                            month={period.to}
                            selectedPlaces={selection ? selected.located : null}
                            userCoverage={userCoverage}
                            programs={programs}
                        />
                    )}
                    {locatingCount > 0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                            {t('panelPartial', { count: locatingCount })}
                        </p>
                    )}
                </div>
                {selection && (
                    <Button
                        variant="ghost"
                        size="xs"
                        className="shrink-0"
                        onClick={onClear}
                    >
                        <ArrowLeft />
                        {scope.title}
                    </Button>
                )}
            </div>

            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={dimension}
                onValueChange={value => {
                    if (value) setDimension(value as TimelineDimension);
                }}
                aria-label={t('chartStackBy')}
            >
                {DIMENSIONS.map(d => (
                    <ToggleGroupItem key={d} value={d} className="px-3 text-xs">
                        {t(`chartDimension.${d}`)}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            <div className="flex flex-col gap-1">
                <p className="text-xs">
                    <span className="font-medium">
                        {t('summaryTotal', {
                            specimens: timeline.total,
                            sessions: selected.sessions.length,
                        })}
                    </span>
                    <span className="text-muted-foreground">
                        {' '}
                        {t('chartInPeriod', { period: periodLabel })}
                    </span>
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={view}
                    onValueChange={value => {
                        if (value) setView(value as ChartView);
                    }}
                    aria-label={t('chartView')}
                >
                    {CHART_VIEWS.map(v => (
                        <ToggleGroupItem
                            key={v}
                            value={v}
                            className="px-3 text-xs"
                        >
                            {t(`chartViews.${v}`)}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <Button
                    variant="outline"
                    size="xs"
                    disabled={timeline.total === 0}
                    onClick={() => setDaily(true)}
                >
                    <Maximize2 />
                    {t('dailyOpen')}
                </Button>
            </div>
            <DailyChartSheet
                open={daily}
                onOpenChange={setDaily}
                title={title}
                period={period}
                sessions={selected.sessions}
                dimensions={DIMENSIONS}
                dimension={dimension}
                onDimensionChange={setDimension}
                ranking={ranking}
            />

            {timeline.total > 0 ? (
                <SelectionChart timeline={timeline} view={view} />
            ) : (
                <p className="text-muted-foreground text-xs">
                    {t('chartEmpty', {
                        count: formatter.number(selected.sessions.length),
                    })}
                </p>
            )}

            {selection && (showSessions || selection.layer === 'devices') && (
                <details className="-mx-2 border-t pt-2">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-2 text-xs font-medium select-none">
                        {selection.layer === 'specimens'
                            ? t('chartListSessions', {
                                  count: selection.ids.length,
                              })
                            : t('chartListDevices', {
                                  count: selection.ids.length,
                              })}
                    </summary>
                    <div>
                        <SelectionList
                            selection={selection}
                            sessions={sessions}
                            devices={devices}
                            programs={programs}
                        />
                    </div>
                </details>
            )}
        </div>
    );
}
