'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import DeviceList from './device-list';

// Leaflet touches window on import.
const DeviceMap = dynamic(() => import('./device-map'), { ssr: false });

function monthDate(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber - 1, 1));
}

export default function DevicesSection({
    dashboard,
    month,
}: {
    dashboard: Dashboard;
    month: string;
}) {
    const t = useTranslations('Devices');
    const formatter = useFormatter();
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);

    const { placed, unplaced, neverUsed, counts, programNames } =
        useMemo(() => {
            const devices = dashboard.devices;
            const used = devices.filter(d => d.status !== 'NEVER_USED');
            return {
                placed: used.flatMap(d =>
                    d.position ? [{ ...d, position: d.position }] : [],
                ),
                unplaced: used.filter(d => !d.position),
                neverUsed: devices.filter(d => d.status === 'NEVER_USED'),
                counts: {
                    total: devices.length,
                    active: devices.filter(d => d.status === 'ACTIVE').length,
                    inactive: devices.filter(d => d.status === 'INACTIVE')
                        .length,
                },
                programNames: new Map(
                    dashboard.programs.map(p => [p.programId, p.name]),
                ),
            };
        }, [dashboard]);

    const selectedDevices = useMemo(() => {
        const ids = new Set(selectedDeviceIds);
        return dashboard.devices.filter(d => ids.has(d.deviceId));
    }, [dashboard.devices, selectedDeviceIds]);

    const monthLabel = formatter.dateTime(monthDate(month), {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });

    return (
        <section
            aria-labelledby="devices-heading"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="devices-heading" className="text-lg font-semibold">
                        {t('heading', { month: monthLabel })}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('counts', {
                            total: counts.total,
                            active: counts.active,
                            inactive: counts.inactive,
                            neverUsed: neverUsed.length,
                            unplaced: unplaced.length,
                        })}
                    </p>
                </div>
                <ul
                    className="text-muted-foreground flex gap-4 text-xs"
                    aria-label={t('legend')}
                >
                    <li className="flex items-center gap-1.5">
                        <span
                            aria-hidden="true"
                            className="size-3 rounded-full bg-[#15803d]"
                        />
                        {t('legendActive')}
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span
                            aria-hidden="true"
                            className="size-3 rounded-full bg-[#6b7280]"
                        />
                        {t('legendIdle')}
                    </li>
                </ul>
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
                <Card className="h-[28rem] overflow-hidden p-0 lg:col-span-3">
                    <DeviceMap
                        devices={placed}
                        fitKey={dashboard.selectedProgramIds.join(',')}
                        selectedDeviceIds={selectedDeviceIds}
                        onSelect={setSelectedDeviceIds}
                    />
                </Card>
                <Card className="h-[28rem] gap-2 py-4 lg:col-span-2">
                    <CardHeader className="px-4">
                        <CardTitle className="text-sm">
                            {t('selectedHeading', {
                                count: selectedDevices.length,
                            })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-auto px-2">
                        <DeviceList
                            devices={selectedDevices}
                            programNames={programNames}
                            emptyMessage={t('selectHint')}
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {[
                    { key: 'unplaced', devices: unplaced },
                    { key: 'neverUsed', devices: neverUsed },
                ].map(({ key, devices }) => (
                    <Card key={key} className="gap-2 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-sm">
                                {t(`${key}.heading`, { count: devices.length })}
                            </CardTitle>
                            <p className="text-muted-foreground text-xs">
                                {t(`${key}.description`)}
                            </p>
                        </CardHeader>
                        <CardContent className="max-h-80 overflow-auto px-2">
                            <DeviceList
                                devices={devices}
                                programNames={programNames}
                                emptyMessage={t(`${key}.empty`)}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}
