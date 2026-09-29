'use client';

import type { Program } from '@/api/program/validation/program-schema';
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
import ProgramLabel from './program-label';

type DeviceListProps = {
    devices: DeviceRow[];
    programs: Map<number, Program>;
    emptyMessage: string;
    /** Adds a Location column explaining why each device is not on the map. */
    locationNotes?: Map<number, string>;
};

export default function DeviceList({
    devices,
    programs,
    emptyMessage,
    locationNotes,
}: DeviceListProps) {
    const t = useTranslations('Devices');
    const formatter = useFormatter();

    if (devices.length === 0) {
        return (
            <p className="text-muted-foreground p-4 text-sm">{emptyMessage}</p>
        );
    }

    return (
        <Table containerClassName="max-h-80 overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow>
                    <TableHead>{t('deviceId')}</TableHead>
                    <TableHead>{t('ssaid')}</TableHead>
                    <TableHead>{t('model')}</TableHead>
                    <TableHead>{t('program')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('lastSubmitted')}</TableHead>
                    {locationNotes && <TableHead>{t('location')}</TableHead>}
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
                            <ProgramLabel
                                program={programs.get(device.programId)}
                            />
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
                        {locationNotes && (
                            <TableCell className="text-muted-foreground">
                                {locationNotes.get(device.deviceId)}
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
