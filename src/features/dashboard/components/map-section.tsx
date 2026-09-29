'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DeviceList from './device-list';
import SelectionList from './selection-list';
import { MAP_LAYERS } from './map-constants';
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
    const [{ layers }, setFilters] = useDashboardFilters();
    const [selection, setSelection] = useState<MapSelection>(null);
    const showSpecimens = layers.includes('specimens');
    const showDevices = layers.includes('devices');

    const view = useMemo(() => {
        const used = dashboard.devices.filter(d => d.status !== 'NEVER_USED');
        const { placed, unplaced } = dashboard.specimenPoints;
        return {
            placedDevices: used.flatMap(d =>
                d.position ? [{ ...d, position: d.position }] : [],
            ),
            unplacedDevices: used.filter(d => !d.position),
            neverUsed: dashboard.devices.filter(d => d.status === 'NEVER_USED'),
            activeCount: dashboard.devices.filter(d => d.status === 'ACTIVE')
                .length,
            placedPoints: placed,
            placedSessions: placed.length,
            placedSpecimens: placed.reduce(
                (sum, p) => sum + p.specimenCount,
                0,
            ),
            unplacedSessions: unplaced.sessions,
            unplacedSpecimens: unplaced.specimens,
            programNames: new Map(
                dashboard.programs.map(p => [p.programId, p.name]),
            ),
        };
    }, [dashboard]);

    const n = (value: number) => formatter.number(value);
    const nothingPlaced =
        (!showSpecimens || view.placedSessions === 0) &&
        (!showDevices || view.placedDevices.length === 0);
    const deviceCounts = {
        total: dashboard.devices.length,
        active: view.activeCount,
        inactive:
            dashboard.devices.length - view.activeCount - view.neverUsed.length,
        neverUsed: view.neverUsed.length,
        unplaced: view.unplacedDevices.length,
    };

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
                                specimens: n(view.placedSpecimens),
                                sessions: n(view.placedSessions),
                                unplacedSpecimens: n(view.unplacedSpecimens),
                                unplacedSessions: n(view.unplacedSessions),
                            })}
                        </p>
                    )}
                    {showDevices && (
                        <p className="text-muted-foreground text-sm">
                            {tDevices('counts', deviceCounts)}
                        </p>
                    )}
                </div>
                <ToggleGroup
                    type="multiple"
                    variant="outline"
                    size="sm"
                    value={layers}
                    onValueChange={values => {
                        setSelection(null);
                        const next = MAP_LAYERS.filter(layer =>
                            values.includes(layer),
                        );
                        // Keep at least one layer on so the map is never blank.
                        if (next.length > 0) setFilters({ layers: next });
                    }}
                    aria-label={t('layer')}
                >
                    <ToggleGroupItem value="specimens" className="px-3">
                        {t('layers.specimens')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="devices" className="px-3">
                        {t('layers.devices')}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
                {/* isolate: keeps Leaflet's z-indexes (400+) below popovers and the toolbar */}
                <Card className="relative isolate h-[34rem] overflow-hidden p-0 lg:col-span-3">
                    <SurveillanceMap
                        layers={layers}
                        specimenPoints={view.placedPoints}
                        devices={view.placedDevices}
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
                    <MapLegend layers={layers} />
                </Card>
                <Card className="max-h-[34rem] gap-2 py-4 lg:h-[34rem]">
                    <CardHeader className="px-4">
                        <CardTitle className="text-sm">
                            {selection
                                ? t(
                                      selection.layer === 'specimens'
                                          ? 'selectedSessions'
                                          : 'selectedDevices',
                                      { count: selection.ids.length },
                                  )
                                : t('selectedNone')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-auto px-2">
                        <SelectionList
                            selection={selection}
                            dashboard={dashboard}
                            programNames={view.programNames}
                        />
                    </CardContent>
                </Card>
            </div>

            {showDevices && (
                <div className="flex flex-col gap-4">
                    {[
                        { key: 'unplaced', devices: view.unplacedDevices },
                        { key: 'neverUsed', devices: view.neverUsed },
                    ].map(({ key, devices }) => (
                        <Card key={key} className="gap-2 py-4">
                            <CardHeader className="px-4">
                                <CardTitle className="text-sm">
                                    {tDevices(`${key}.heading`, {
                                        count: devices.length,
                                    })}
                                </CardTitle>
                                <p className="text-muted-foreground text-xs">
                                    {tDevices(`${key}.description`)}
                                </p>
                            </CardHeader>
                            <CardContent className="max-h-80 overflow-auto px-2">
                                <DeviceList
                                    devices={devices}
                                    programNames={view.programNames}
                                    emptyMessage={tDevices(`${key}.empty`)}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </section>
    );
}
