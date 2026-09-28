'use client';

import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { DeviceRow } from '@/features/dashboard/utils/classify-devices';
import { useFormatter, useTranslations } from 'next-intl';

type DeviceListProps = {
    devices: DeviceRow[];
    programNames: Map<number, string>;
    emptyMessage: string;
};

export default function DeviceList({
    devices,
    programNames,
    emptyMessage,
}: DeviceListProps) {
    const t = useTranslations('Devices');
    const formatter = useFormatter();

    if (devices.length === 0) {
        return (
            <p className="text-muted-foreground p-4 text-sm">{emptyMessage}</p>
        );
    }

    return (
        <Table>
            <TableHeader className="bg-card sticky top-0">
                <TableRow>
                    <TableHead>{t('deviceId')}</TableHead>
                    <TableHead>{t('ssaid')}</TableHead>
                    <TableHead>{t('model')}</TableHead>
                    <TableHead>{t('program')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('lastSubmitted')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {devices.map(device => (
                    <TableRow key={device.deviceId}>
                        <TableCell className="tabular-nums">
                            {device.deviceId}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                            {device.ssaid ?? (
                                <span className="text-muted-foreground">
                                    {t('unknown')}
                                </span>
                            )}
                        </TableCell>
                        <TableCell>{device.model}</TableCell>
                        <TableCell>
                            {programNames.get(device.programId) ??
                                device.programId}
                        </TableCell>
                        <TableCell>
                            <Badge
                                variant={
                                    device.status === 'ACTIVE'
                                        ? 'default'
                                        : 'outline'
                                }
                            >
                                {t(`statuses.${device.status}`)}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                            {device.lastSubmittedAt === null
                                ? t('never')
                                : formatter.dateTime(device.lastSubmittedAt, {
                                      dateStyle: 'medium',
                                  })}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
