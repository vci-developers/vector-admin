'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    buildSelectionTimeline,
    type TimelineDimension,
} from '@/features/dashboard/utils/build-selection-timeline';
import type { SpecimenFacets } from '@/features/dashboard/utils/filter-map-points';
import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import { programTitle } from '@/features/dashboard/utils/program-title';
import { ArrowLeft } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import SelectionChart, { CHART_VIEWS, type ChartView } from './selection-chart';
import SelectionList from './selection-list';
import { HiddenNote, type SummarySession } from './specimen-summary';
import type { MapSelection } from './surveillance-map';

const DIMENSIONS: TimelineDimension[] = ['species', 'sex', 'abdomen'];

type SelectionPanelProps = {
    selection: MapSelection;
    /** The Sessions drawn on the map, after the map filters. */
    sessions: PlacedSession[];
    devices: PlacedDevice[];
    sessionsByDevice: Map<number, (SummarySession & { collectedAt: number })[]>;
    programs: Map<number, Program>;
    facets: SpecimenFacets;
    period: { from: string; to: string; label: string };
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
    onClear,
}: SelectionPanelProps) {
    const t = useTranslations('MapSection');
    const formatter = useFormatter();
    const [dimension, setDimension] = useState<TimelineDimension>('species');
    // Temporary: lets us compare chart forms before settling on one.
    const [view, setView] = useState<ChartView>('pie');

    const selected = useMemo(() => {
        if (!selection) return { sessions, programIds: [] as number[] };
        const ids = new Set(selection.ids);
        if (selection.layer === 'specimens') {
            const picked = sessions.filter(s => ids.has(s.sessionId));
            return {
                sessions: picked,
                programIds: [...new Set(picked.map(s => s.programId))],
            };
        }
        const picked = devices.filter(d => ids.has(d.deviceId));
        return {
            // A device reports everything it submitted, whatever the filters.
            sessions: picked.flatMap(
                d => sessionsByDevice.get(d.deviceId) ?? [],
            ),
            programIds: [...new Set(picked.map(d => d.programId))],
        };
    }, [selection, sessions, devices, sessionsByDevice]);

    const periodLabel = period.label;
    const timeline = useMemo(
        () =>
            buildSelectionTimeline({
                sessions: selected.sessions,
                period,
                dimension,
                ranking: rankingOf(facets[dimension]),
            }),
        [selected.sessions, period, dimension, facets],
    );

    const title = !selection
        ? t('chartWholeMap')
        : selection.layer === 'specimens'
          ? t('selectedSessions', { count: selection.ids.length })
          : t('selectedDevices', { count: selection.ids.length });
    const programLine = selected.programIds
        .map(id => programs.get(id))
        .filter((p): p is Program => Boolean(p))
        .map(programTitle)
        .join(' · ');

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {programLine && (
                        <p className="text-muted-foreground truncate text-xs">
                            {programLine}
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
                        {t('chartBack')}
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
                <HiddenNote sessions={selected.sessions} />
            </div>

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
                    <ToggleGroupItem key={v} value={v} className="px-3 text-xs">
                        {t(`chartViews.${v}`)}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>

            {timeline.total > 0 ? (
                <SelectionChart timeline={timeline} view={view} />
            ) : (
                <p className="text-muted-foreground text-xs">
                    {t('chartEmpty', {
                        count: formatter.number(selected.sessions.length),
                    })}
                </p>
            )}

            {selection && (
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
