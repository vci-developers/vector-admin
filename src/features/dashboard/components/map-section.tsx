'use client';

import type {
    CountryOutlineDto,
    CoverageDto,
} from '@/api/coverage/validation/coverage-schema';
import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { useMapFilters } from '@/features/dashboard/hooks/use-map-filters';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { useGetSiteLocations } from '@/api/site-locations/hooks/use-get-site-locations';
import {
    buildSpecimenFacets,
    activeDevices,
    filterSessions,
} from '@/features/dashboard/utils/filter-map-points';
import { areaKey } from '@/features/dashboard/utils/build-area-marks';
import { findMapGaps } from '@/features/dashboard/utils/find-map-gaps';
import { scopeTitle } from '@/features/dashboard/utils/program-title';
import { unitSessionIds } from '@/features/dashboard/utils/search-map';
import {
    placeBySite,
    sitesToLocate,
} from '@/features/dashboard/utils/place-by-site';
import { cn } from '@/utils/cn';
import { Info, Loader2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DeviceListCard from './device-list-card';
import SelectionPanel from './selection-panel';
import MapFilters from './map-filters';
import MapGaps from './map-gaps';
import MapLegend from './map-legend';
import MapSearch from './map-search';
import type { MapFocus, MapSelection, SelectedUnit } from './surveillance-map';

// Leaflet touches window on import.
const SurveillanceMap = dynamic(() => import('./surveillance-map'), {
    ssr: false,
});

export default function MapSection({
    dashboard,
    coverage,
    outlines,
    period,
}: {
    dashboard: Dashboard;
    /** Loaded separately; null while it loads. */
    coverage: CoverageDto | null;
    /** The selected Programs' countries; empty while coverage loads. */
    outlines: CountryOutlineDto[];
    period: DisplayPeriod;
}) {
    const t = useTranslations('MapSection');
    const tDevices = useTranslations('Devices');
    const formatter = useFormatter();
    const [{ layers, exclude }] = useDashboardFilters();
    const { specimenFilter } = useMapFilters();
    const [selection, setSelection] = useState<MapSelection>(null);
    const [focus, setFocus] = useState<MapFocus>(null);
    // Closed, the empty-map note shrinks to an info button so it can be reread.
    const [emptyNoteOpen, setEmptyNoteOpen] = useState(true);
    const showSpecimens = layers.includes('specimens');
    const showDevices = layers.includes('devices');
    const showCoverage = layers.includes('coverage');

    const siteIds = useMemo(() => sitesToLocate(dashboard), [dashboard]);
    const siteQuery = useGetSiteLocations(exclude, siteIds);
    const siteResult = siteQuery.data;
    // Until the first answer, nothing placed by Site is known yet.
    const sitesLoading = siteIds.length > 0 && !siteResult;

    const view = useMemo(() => {
        // Until the first answer arrives, every Site counts as still locating.
        const sites = siteResult?.ok
            ? {
                  locations: siteResult.data.locations,
                  pending: new Set(siteResult.data.pending),
              }
            : { locations: {}, pending: new Set(siteIds) };
        const placement = placeBySite(dashboard, sites);
        // Map filters apply after placement, so counts stay per placement kind.
        const sessions = {
            placed: filterSessions(placement.sessions.placed, specimenFilter),
            unplaced: filterSessions(
                placement.sessions.unplaced,
                specimenFilter,
            ),
        };
        const devices = {
            placed: activeDevices(placement.devices.placed),
            unplaced: activeDevices(placement.devices.unplaced),
        };
        const allSessions = [
            ...placement.sessions.placed,
            ...placement.sessions.unplaced.map(session => ({
                ...session,
                location: dashboard.sitePaths[session.siteId] ?? [],
            })),
        ];
        const sum = (items: { specimenCount: number }[]) =>
            items.reduce((total, item) => total + item.specimenCount, 0);
        const bySite = sessions.placed.filter(p => p.placement.by === 'site');
        return {
            devices,
            sessions,
            facets: buildSpecimenFacets([
                ...placement.sessions.placed,
                ...placement.sessions.unplaced,
            ]),
            locatingCount: sites.pending.size,
            neverUsed: dashboard.devices.filter(d => d.status === 'NEVER_USED'),
            activeCount: dashboard.devices.filter(d => d.status === 'ACTIVE')
                .length,
            specimens: {
                gps: sum(sessions.placed) - sum(bySite),
                site: sum(bySite),
                unplaced: sum(sessions.unplaced),
                unplacedSessions: sessions.unplaced.length,
            },
            programs: new Map(dashboard.programs.map(p => [p.programId, p])),
            gaps: findMapGaps({
                programIds: dashboard.selectedProgramIds.filter(
                    id => !dashboard.failedProgramIds.includes(id),
                ),
                sessions: showSpecimens
                    ? {
                          all: [
                              ...placement.sessions.placed,
                              ...placement.sessions.unplaced,
                          ],
                          shown: [...sessions.placed, ...sessions.unplaced],
                          placed: sessions.placed,
                      }
                    : null,
                devices: showDevices
                    ? {
                          all: [...devices.placed, ...devices.unplaced],
                          shown: [...devices.placed, ...devices.unplaced],
                          placed: devices.placed,
                      }
                    : null,
            }),
            // What the tiles count: every Session the Session filter kept,
            // whatever the map filters show, each with its Site's places.
            tileSessions: allSessions,
            devicePlans: new Map(
                dashboard.areaDevicePlans.map(row => [
                    areaKey(row.programId, row.area),
                    row.planned,
                ]),
            ),
            // A Stakeholder's badges count devices as the server does.
            deviceCounts:
                dashboard.deviceCounts &&
                new Map(
                    dashboard.deviceCounts.map(row => [
                        areaKey(row.programId, row.area),
                        row.count,
                    ]),
                ),
            // What each device submitted in the period, whatever the map
            // filters: a device popup reports its Sessions, not the circles.
            sessionsByDevice: Map.groupBy(
                allSessions,
                session => session.deviceId,
            ),
        };
    }, [
        dashboard,
        siteIds,
        siteResult,
        specimenFilter,
        showSpecimens,
        showDevices,
    ]);

    const n = (value: number) => formatter.number(value);
    // Stakeholders get summaries: no Session's own record, no device lists.
    const isDeveloper = dashboard.viewer === 'developer';
    const fills = showCoverage && coverage?.ok ? coverage.data.fills : [];
    const selectedPrograms = dashboard.programs.filter(p =>
        dashboard.selectedProgramIds.includes(p.programId),
    );
    // The whole map is named for what the Program filter selects.
    const scope = {
        title: scopeTitle(selectedPrograms),
        single: selectedPrograms.length === 1,
    };
    const coverageFailed = showCoverage && coverage?.ok === false;
    // Each unit's Sessions, from every Session on the map whichever layers
    // are on, so search and clicks select the same thing.
    const units = fills.map(fill => ({
        programId: fill.programId,
        unit: fill.unit,
        status: fill.status,
        sessionIds: unitSessionIds(fill, view.sessions.placed),
    }));
    const selectUnit = (unit: SelectedUnit) =>
        setSelection({
            layer: 'specimens',
            ids: unitSessionIds(unit, view.sessions.placed),
            unit,
        });
    // Only point layers can be empty; Coverage alone is not "nothing placed".
    const nothingPlaced =
        (showSpecimens || showDevices) &&
        (!showSpecimens || view.sessions.placed.length === 0) &&
        (!showDevices || view.devices.placed.length === 0);
    const deviceCounts = {
        total: dashboard.devices.length,
        active: view.activeCount,
        inactive:
            dashboard.devices.length - view.activeCount - view.neverUsed.length,
        neverUsed: view.neverUsed.length,
        bySite: view.devices.placed.filter(d => d.placement.by === 'site')
            .length,
        unplaced: view.devices.unplaced.length,
    };
    const locationNotes = new Map(
        view.devices.unplaced.map(d => [
            d.deviceId,
            tDevices(d.reason === 'locating' ? 'locating' : 'noLocation'),
        ]),
    );

    return (
        // Stakeholders get no heading or placement notes: the summary right
        // above already names the period.
        <section
            aria-labelledby={isDeveloper ? 'map-heading' : undefined}
            aria-label={isDeveloper ? undefined : t('label')}
            className={cn('flex flex-col gap-4', !isDeveloper && 'lg:flex-1')}
        >
            {(isDeveloper || coverageFailed) && (
                <div>
                    {isDeveloper && (
                        <h2 id="map-heading" className="text-lg font-semibold">
                            {t('heading', { period: period.label })}
                        </h2>
                    )}
                    {isDeveloper && showSpecimens && sitesLoading && (
                        <Skeleton height="sm" width="xl" className="my-1" />
                    )}
                    {isDeveloper && showSpecimens && !sitesLoading && (
                        <p className="text-muted-foreground text-sm">
                            {t('specimenStats', {
                                gps: n(view.specimens.gps),
                                site: n(view.specimens.site),
                                unplaced: n(view.specimens.unplaced),
                                unplacedSessions: n(
                                    view.specimens.unplacedSessions,
                                ),
                            })}
                        </p>
                    )}
                    {showDevices && isDeveloper && (
                        <p className="text-muted-foreground text-sm">
                            {tDevices('counts', deviceCounts)}
                        </p>
                    )}
                    {isDeveloper &&
                        showCoverage &&
                        coverage?.ok &&
                        coverage.data.unmatched.length > 0 && (
                            <p className="text-muted-foreground text-sm">
                                {t('coverageUnmatched', {
                                    units: coverage.data.unmatched
                                        .map(u => u.unit)
                                        .join(', '),
                                })}
                            </p>
                        )}
                    {coverageFailed && (
                        <p className="text-destructive text-sm">
                            {t('coverageUnavailable')}
                        </p>
                    )}
                </div>
            )}

            {/* Stakeholders: the row fills the rest of the window, never
                under 24rem; Developers keep a fixed height above their lists. */}
            <div
                className={cn(
                    'grid gap-4 lg:grid-cols-4',
                    !isDeveloper &&
                        'lg:flex-1 lg:grid-rows-[minmax(24rem,1fr)]',
                )}
            >
                {/* isolate: keeps Leaflet's z-indexes (400+) below popovers and the toolbar */}
                <Card
                    className={cn(
                        'relative isolate h-[34rem] overflow-hidden p-0 lg:col-span-3',
                        !isDeveloper && 'lg:h-auto',
                    )}
                >
                    <SurveillanceMap
                        layers={layers}
                        coverageFills={fills}
                        outlines={outlines}
                        specimenPoints={view.sessions.placed}
                        devices={view.devices.placed}
                        sessionsByDevice={view.sessionsByDevice}
                        programs={view.programs}
                        fitKey={dashboard.selectedProgramIds.join(',')}
                        dataKey={`${period.from}:${period.to}:${dashboard.selectedProgramIds.join(',')}`}
                        selection={selection}
                        onSelect={setSelection}
                        onSelectUnit={selectUnit}
                        focus={focus}
                        showSessions={isDeveloper}
                        // Stakeholders see specimens per Area, not per Session.
                        byArea={!isDeveloper}
                        deviceCounts={view.deviceCounts ?? undefined}
                        devicePlans={view.devicePlans}
                    />
                    {/* Beside Leaflet's zoom buttons. */}
                    <div className="absolute top-2.5 left-14 z-[1000]">
                        <MapSearch
                            sessions={showSpecimens ? view.sessions.placed : []}
                            devices={showDevices ? view.devices.placed : []}
                            units={units}
                            showSessions={isDeveloper}
                            onPick={result => {
                                const { layer, ids } = result;
                                const unit =
                                    result.kind === 'unit'
                                        ? {
                                              ...result.unit,
                                              status: result.status,
                                          }
                                        : undefined;
                                setSelection({ layer, ids, unit });
                                setFocus(current => ({
                                    layer,
                                    ids,
                                    unit,
                                    seq: (current?.seq ?? 0) + 1,
                                }));
                            }}
                        />
                    </div>
                    {nothingPlaced && emptyNoteOpen && (
                        <div className="bg-card/95 absolute top-1/2 left-1/2 z-[1000] flex max-w-xs -translate-x-1/2 -translate-y-1/2 items-start gap-2 rounded-md border py-3 pr-2 pl-4 text-sm shadow-sm">
                            <p className="text-center">
                                {t('emptyMap', { period: period.label })}
                            </p>
                            <button
                                type="button"
                                aria-label={t('emptyMapClose')}
                                onClick={() => setEmptyNoteOpen(false)}
                                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 shrink-0 rounded-sm outline-none focus-visible:ring-[3px]"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                    <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <MapGaps
                                gaps={view.gaps}
                                programs={view.programs}
                                periodLabel={period.label}
                                onChange={() => setSelection(null)}
                            />
                            <MapFilters
                                facets={view.facets}
                                onChange={() => setSelection(null)}
                            />
                        </div>
                        {view.locatingCount > 0 && (
                            <p
                                role="status"
                                className="bg-card/95 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs shadow-sm"
                            >
                                <Loader2
                                    className="size-3 animate-spin"
                                    aria-hidden="true"
                                />
                                {t('locatingSites', {
                                    count: view.locatingCount,
                                })}
                            </p>
                        )}
                        {nothingPlaced && !emptyNoteOpen && (
                            <button
                                type="button"
                                aria-label={t('emptyMapOpen')}
                                title={t('emptyMapOpen')}
                                onClick={() => setEmptyNoteOpen(true)}
                                className="bg-card/95 text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-md border p-1.5 shadow-sm outline-none focus-visible:ring-[3px]"
                            >
                                <Info className="size-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <MapLegend layers={layers} byArea={!isDeveloper} />
                </Card>
                <Card
                    className={cn(
                        'max-h-[34rem] gap-0 py-4 lg:h-[34rem]',
                        !isDeveloper &&
                            'lg:relative lg:h-auto lg:max-h-none lg:py-0',
                    )}
                >
                    {/* Stakeholders: laid over the card, so the panel's content
                        never counts towards the row's height (a tall panel
                        stretched the map and scrolled the page); it scrolls
                        inside instead. */}
                    <div
                        className={cn(
                            'flex min-h-0 flex-1 flex-col',
                            !isDeveloper && 'lg:absolute lg:inset-0 lg:py-4',
                        )}
                    >
                        <SelectionPanel
                            selection={selection}
                            sessions={view.sessions.placed}
                            devices={view.devices.placed}
                            sessionsByDevice={view.sessionsByDevice}
                            programs={view.programs}
                            facets={view.facets}
                            period={period}
                            loading={sitesLoading}
                            locatingCount={view.locatingCount}
                            showSessions={isDeveloper}
                            scope={scope}
                            tileSessions={view.tileSessions}
                            deviceCounts={dashboard.deviceCounts ?? []}
                            projectedDevices={dashboard.projectedDevices}
                            plannedAreas={dashboard.plannedAreas}
                            areaDevicePlans={dashboard.areaDevicePlans}
                            userCoverage={dashboard.userCoverage}
                            onClear={() => setSelection(null)}
                        />
                    </div>
                </Card>
            </div>

            {showDevices && isDeveloper && (
                <div className="flex flex-col gap-4">
                    {[
                        { key: 'unplaced', devices: view.devices.unplaced },
                        { key: 'neverUsed', devices: view.neverUsed },
                    ].map(({ key, devices }) => (
                        <DeviceListCard
                            key={key}
                            heading={tDevices(`${key}.heading`, {
                                count: devices.length,
                            })}
                            description={tDevices(`${key}.description`)}
                            emptyMessage={tDevices(`${key}.empty`)}
                            devices={devices}
                            programs={view.programs}
                            locationNotes={
                                key === 'unplaced' ? locationNotes : undefined
                            }
                            collapsible={key === 'neverUsed'}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
