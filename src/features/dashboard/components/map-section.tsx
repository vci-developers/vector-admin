'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { useMapFilters } from '@/features/dashboard/hooks/use-map-filters';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { useGetSiteLocations } from '@/api/site-locations/hooks/use-get-site-locations';
import {
    buildSpecimenFacets,
    filterDevices,
    filterSessions,
} from '@/features/dashboard/utils/filter-map-points';
import { findMapGaps } from '@/features/dashboard/utils/find-map-gaps';
import {
    placeBySite,
    sitesToLocate,
} from '@/features/dashboard/utils/place-by-site';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DeviceListCard from './device-list-card';
import SelectionPanel from './selection-panel';
import MapFilters from './map-filters';
import MapGaps from './map-gaps';
import MapLegend from './map-legend';
import type { MapSelection } from './surveillance-map';

// Leaflet touches window on import.
const SurveillanceMap = dynamic(() => import('./surveillance-map'), {
    ssr: false,
});

export default function MapSection({
    dashboard,
    period,
}: {
    dashboard: Dashboard;
    period: DisplayPeriod;
}) {
    const t = useTranslations('MapSection');
    const tDevices = useTranslations('Devices');
    const formatter = useFormatter();
    const [{ layers, exclude }] = useDashboardFilters();
    const { filters: mapFilters, specimenFilter } = useMapFilters();
    const [selection, setSelection] = useState<MapSelection>(null);
    const showSpecimens = layers.includes('specimens');
    const showDevices = layers.includes('devices');

    const siteIds = useMemo(() => sitesToLocate(dashboard), [dashboard]);
    const siteQuery = useGetSiteLocations(exclude, siteIds);
    const siteResult = siteQuery.data;

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
            placed: filterDevices(
                placement.devices.placed,
                mapFilters.deviceStatus,
            ),
            unplaced: filterDevices(
                placement.devices.unplaced,
                mapFilters.deviceStatus,
            ),
        };
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
                          all: [
                              ...placement.devices.placed,
                              ...placement.devices.unplaced,
                          ],
                          shown: [...devices.placed, ...devices.unplaced],
                          placed: devices.placed,
                      }
                    : null,
            }),
            // What each device submitted in the period, whatever the map
            // filters: a device popup reports its Sessions, not the circles.
            sessionsByDevice: Map.groupBy(
                [...placement.sessions.placed, ...placement.sessions.unplaced],
                session => session.deviceId,
            ),
        };
    }, [
        dashboard,
        siteIds,
        siteResult,
        specimenFilter,
        mapFilters.deviceStatus,
        showSpecimens,
        showDevices,
    ]);

    const n = (value: number) => formatter.number(value);
    const nothingPlaced =
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
        <section aria-labelledby="map-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="map-heading" className="text-lg font-semibold">
                        {t('heading', { period: period.label })}
                    </h2>
                    {showSpecimens && (
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
                    {showDevices && (
                        <p className="text-muted-foreground text-sm">
                            {tDevices('counts', deviceCounts)}
                        </p>
                    )}
                </div>
                <MapFilters
                    facets={view.facets}
                    deviceCounts={{
                        ACTIVE: deviceCounts.active,
                        INACTIVE: deviceCounts.inactive,
                    }}
                    onChange={() => setSelection(null)}
                />
            </div>

            <MapGaps
                gaps={view.gaps}
                programs={view.programs}
                periodLabel={period.label}
                onChange={() => setSelection(null)}
            />

            <div className="grid gap-4 lg:grid-cols-4">
                {/* isolate: keeps Leaflet's z-indexes (400+) below popovers and the toolbar */}
                <Card className="relative isolate h-[34rem] overflow-hidden p-0 lg:col-span-3">
                    <SurveillanceMap
                        layers={layers}
                        specimenPoints={view.sessions.placed}
                        devices={view.devices.placed}
                        sessionsByDevice={view.sessionsByDevice}
                        programs={view.programs}
                        fitKey={dashboard.selectedProgramIds.join(',')}
                        dataKey={`${period.from}:${period.to}:${dashboard.selectedProgramIds.join(',')}`}
                        selection={selection}
                        onSelect={setSelection}
                    />
                    {nothingPlaced && (
                        <p className="bg-card/95 absolute top-1/2 left-1/2 z-[1000] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-md border px-4 py-3 text-center text-sm shadow-sm">
                            {t('emptyMap', { period: period.label })}
                        </p>
                    )}
                    {view.locatingCount > 0 && (
                        <p
                            role="status"
                            className="bg-card/95 absolute top-3 right-3 z-[1000] flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs shadow-sm"
                        >
                            <Loader2
                                className="size-3 animate-spin"
                                aria-hidden="true"
                            />
                            {t('locatingSites', { count: view.locatingCount })}
                        </p>
                    )}
                    <MapLegend layers={layers} />
                </Card>
                <Card className="max-h-[34rem] gap-0 py-4 lg:h-[34rem]">
                    <SelectionPanel
                        selection={selection}
                        sessions={view.sessions.placed}
                        devices={view.devices.placed}
                        sessionsByDevice={view.sessionsByDevice}
                        programs={view.programs}
                        facets={view.facets}
                        period={period}
                        onClear={() => setSelection(null)}
                    />
                </Card>
            </div>

            {showDevices && (
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
