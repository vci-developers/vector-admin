'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Badge } from '@/components/ui/badge';
import { useFormatter, useTranslations } from 'next-intl';
import type { MapSelection } from './surveillance-map';

type SelectionListProps = {
    selection: MapSelection;
    dashboard: Dashboard;
    programNames: Map<number, string>;
};

export default function SelectionList({
    selection,
    dashboard,
    programNames,
}: SelectionListProps) {
    const t = useTranslations('MapSection');
    const tDevices = useTranslations('Devices');
    const formatter = useFormatter();
    const ids = new Set(selection?.ids);
    const formatDate = (timestamp: number) =>
        formatter.dateTime(timestamp, { dateStyle: 'medium' });

    if (!selection || selection.ids.length === 0) {
        return (
            <p className="text-muted-foreground p-2 text-sm">
                {t('selectHint')}
            </p>
        );
    }

    if (selection.layer === 'specimens') {
        const sessions = dashboard.specimenPoints.placed
            .filter(point => ids.has(point.sessionId))
            .sort((a, b) => b.specimenCount - a.specimenCount);
        return (
            <ul className="divide-y">
                {sessions.map(point => (
                    <li
                        key={point.sessionId}
                        className="flex flex-col gap-0.5 px-2 py-2 text-sm"
                    >
                        <p className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                                {t('sessionLabel', { id: point.sessionId })}
                            </span>
                            <span className="tabular-nums">
                                {t('specimenCount', {
                                    count: point.specimenCount,
                                })}
                            </span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                            {programNames.get(point.programId)}
                            {' · '}
                            {t('deviceLabel', { id: point.deviceId })}
                            {' · '}
                            {formatDate(point.collectedAt)}
                        </p>
                    </li>
                ))}
            </ul>
        );
    }

    const devices = dashboard.devices.filter(device =>
        ids.has(device.deviceId),
    );
    return (
        <ul className="divide-y">
            {devices.map(device => (
                <li
                    key={device.deviceId}
                    className="flex flex-col gap-0.5 px-2 py-2 text-sm"
                >
                    <p className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                            {t('deviceLabel', { id: device.deviceId })}
                        </span>
                        <Badge
                            variant={
                                device.status === 'ACTIVE'
                                    ? 'default'
                                    : 'outline'
                            }
                        >
                            {tDevices(`statuses.${device.status}`)}
                        </Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {device.model}
                        {' · '}
                        <span className="font-mono">
                            {device.ssaid ?? tDevices('unknown')}
                        </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {programNames.get(device.programId)}
                        {' · '}
                        {device.lastSubmittedAt === null
                            ? tDevices('never')
                            : t('lastSubmitted', {
                                  date: formatDate(device.lastSubmittedAt),
                              })}
                    </p>
                </li>
            ))}
        </ul>
    );
}
