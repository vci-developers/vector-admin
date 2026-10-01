'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Badge } from '@/components/ui/badge';
import type {
    PlacedDevice,
    PlacedSession,
    Placement,
} from '@/features/dashboard/utils/place-by-site';
import { programTitle } from '@/features/dashboard/utils/program-title';
import { useFormatter, useTranslations } from 'next-intl';
import LocationPath from './location-path';

function PlacementNote({ placement }: { placement: Placement }) {
    const t = useTranslations('MapSection');
    if (placement.by === 'gps') return null;
    return (
        <p className="text-muted-foreground text-xs italic">
            {t('placedBySite', { site: placement.siteName })}
        </p>
    );
}

function useDetailFormatters(program: Program | undefined, programId: number) {
    const formatter = useFormatter();
    return {
        programLine: program ? programTitle(program) : programId,
        formatDate: (timestamp: number) =>
            formatter.dateTime(timestamp, { dateStyle: 'medium' }),
    };
}

/** One Session's specimens, as listed beside the map and in its popup. */
export function SessionDetails({
    session,
    program,
}: {
    session: PlacedSession;
    program: Program | undefined;
}) {
    const t = useTranslations('MapSection');
    const { programLine, formatDate } = useDetailFormatters(
        program,
        session.programId,
    );
    return (
        <div className="flex flex-col gap-0.5 text-sm">
            <p className="flex items-center justify-between gap-2">
                <span className="font-medium">
                    {t('sessionLabel', { id: session.sessionId })}
                </span>
                <span className="tabular-nums">
                    {t('specimenCount', { count: session.specimenCount })}
                </span>
            </p>
            <p className="text-muted-foreground text-xs">
                {programLine}
                {' · '}
                {t('deviceLabel', { id: session.deviceId })}
                {' · '}
                {formatDate(session.collectedAt)}
            </p>
            <LocationPath items={[session]} />
            <PlacementNote placement={session.placement} />
        </div>
    );
}

/** One device, as listed beside the map and in its popup. */
export function DeviceDetails({
    device,
    program,
}: {
    device: PlacedDevice;
    program: Program | undefined;
}) {
    const t = useTranslations('MapSection');
    const tDevices = useTranslations('Devices');
    const { programLine, formatDate } = useDetailFormatters(
        program,
        device.programId,
    );
    return (
        <div className="flex flex-col gap-0.5 text-sm">
            <p className="flex items-center justify-between gap-2">
                <span className="font-medium">
                    {t('deviceLabel', { id: device.deviceId })}
                </span>
                <Badge
                    variant={device.status === 'ACTIVE' ? 'default' : 'outline'}
                >
                    {tDevices(`statuses.${device.status}`)}
                </Badge>
            </p>
            <p className="text-muted-foreground text-xs">{device.model}</p>
            <p className="text-muted-foreground text-xs">
                {programLine}
                {' · '}
                {device.lastSubmittedAt === null
                    ? tDevices('never')
                    : t('lastSubmitted', {
                          date: formatDate(device.lastSubmittedAt),
                      })}
            </p>
            <LocationPath items={[device]} />
            <PlacementNote placement={device.placement} />
        </div>
    );
}
