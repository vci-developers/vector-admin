'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DeviceList from './device-list';
import SelectionList from './selection-list';
import { ACTIVE_COLOR, IDLE_COLOR, type MapLayer } from './surveillance-map';

// Leaflet touches window on import.
const SurveillanceMap = dynamic(() => import('./surveillance-map'), {
    ssr: false,
});

export default function MapSection({
    dashboard,
    month,
    monthLabel,
}: {
    dashboard: Dashboard;
    month: string;
    monthLabel: string;
}) {
    const t = useTranslations('MapSection');
    const tDevices = useTranslations('Devices');
    const formatter = useFormatter();
    const [{ layer }, setFilters] = useDashboardFilters();
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const view = useMemo(() => {
        const used = dashboard.devices.filter(d => d.status !== 'NEVER_USED');
        const { placed, unplacedSessions, unplacedSpecimens } =
            dashboard.specimenPoints;
        return {
            placedDevices: used.flatMap(d =>
                d.position ? [{ ...d, position: d.position }] : [],
            ),
            unplacedDevices: used.filter(d => !d.position),
            neverUsed: dashboard.devices.filter(d => d.status === 'NEVER_USED'),
            activeCount: dashboard.devices.filter(d => d.status === 'ACTIVE')
                .length,
            placedSessions: placed.length,
            placedSpecimens: placed.reduce(
                (sum, p) => sum + p.specimenCount,
                0,
            ),
            unplacedSessions,
            unplacedSpecimens,
            programNames: new Map(
                dashboard.programs.map(p => [p.programId, p.name]),
            ),
        };
    }, [dashboard]);

    const n = (value: number) => formatter.number(value);

    return (
        <section aria-labelledby="map-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="map-heading" className="text-lg font-semibold">
                        {t('heading', { month: monthLabel })}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {layer === 'specimens'
                            ? t('specimenStats', {
                                  specimens: n(view.placedSpecimens),
                                  sessions: n(view.placedSessions),
                                  unplacedSpecimens: n(view.unplacedSpecimens),
                                  unplacedSessions: n(view.unplacedSessions),
                              })
                            : tDevices('counts', {
                                  total: dashboard.devices.length,
                                  active: view.activeCount,
                                  inactive:
                                      dashboard.devices.length -
                                      view.activeCount -
                                      view.neverUsed.length,
                                  neverUsed: view.neverUsed.length,
                                  unplaced: view.unplacedDevices.length,
                              })}
                    </p>
                </div>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={layer}
                    onValueChange={value => {
                        if (!value) return;
                        setSelectedIds([]);
                        setFilters({ layer: value as MapLayer });
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
                <Card className="relative h-[34rem] overflow-hidden p-0 lg:col-span-3">
                    <SurveillanceMap
                        layer={layer}
                        specimenPoints={dashboard.specimenPoints.placed}
                        devices={view.placedDevices}
                        fitKey={dashboard.selectedProgramIds.join(',')}
                        dataKey={`${month}:${dashboard.selectedProgramIds.join(',')}`}
                        selectedIds={selectedIds}
                        onSelect={setSelectedIds}
                    />
                    <ul
                        aria-label={t('legend')}
                        className="bg-card/90 absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-md border px-3 py-2 text-xs shadow-sm"
                    >
                        {layer === 'specimens' ? (
                            <>
                                <li className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="bg-primary size-3 rounded-full"
                                    />
                                    {t('legendSpecimens')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="border-primary size-3 rounded-full border-2"
                                    />
                                    {t('legendZeroCatch')}
                                </li>
                            </>
                        ) : (
                            <>
                                <li className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-3 rounded-full"
                                        style={{ background: ACTIVE_COLOR }}
                                    />
                                    {tDevices('legendActive')}
                                </li>
                                <li className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-3 rounded-full"
                                        style={{ background: IDLE_COLOR }}
                                    />
                                    {tDevices('legendIdle')}
                                </li>
                            </>
                        )}
                    </ul>
                </Card>
                <Card className="h-[34rem] gap-2 py-4">
                    <CardHeader className="px-4">
                        <CardTitle className="text-sm">
                            {t(
                                layer === 'specimens'
                                    ? 'selectedSessions'
                                    : 'selectedDevices',
                                {
                                    count: selectedIds.length,
                                },
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-auto px-2">
                        <SelectionList
                            layer={layer}
                            selectedIds={selectedIds}
                            dashboard={dashboard}
                            programNames={view.programNames}
                        />
                    </CardContent>
                </Card>
            </div>

            {layer === 'devices' && (
                <div className="grid gap-4 lg:grid-cols-2">
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
