'use client';

import type { Program } from '@/api/program/validation/program-schema';
import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import { useTranslations } from 'next-intl';
import { DeviceDetails, SessionDetails } from './map-point-details';
import type { MapSelection } from './surveillance-map';

type SelectionListProps = {
    selection: MapSelection;
    sessions: PlacedSession[];
    devices: PlacedDevice[];
    programs: Map<number, Program>;
};

export default function SelectionList({
    selection,
    sessions,
    devices,
    programs,
}: SelectionListProps) {
    const t = useTranslations('MapSection');
    const ids = new Set(selection?.ids);

    if (!selection || selection.ids.length === 0) {
        return (
            <p className="text-muted-foreground p-2 text-sm">
                {t('selectHint')}
            </p>
        );
    }

    if (selection.layer === 'specimens') {
        const selected = sessions
            .filter(session => ids.has(session.sessionId))
            .sort((a, b) => b.specimenCount - a.specimenCount);
        return (
            <>
                <ul className="divide-y">
                    {selected.map(session => (
                        <li key={session.sessionId} className="px-2 py-2">
                            <SessionDetails
                                session={session}
                                program={programs.get(session.programId)}
                            />
                        </li>
                    ))}
                </ul>
            </>
        );
    }

    const selectedDevices = devices.filter(device => ids.has(device.deviceId));
    return (
        <>
            <ul className="divide-y">
                {selectedDevices.map(device => (
                    <li key={device.deviceId} className="px-2 py-2">
                        <DeviceDetails
                            device={device}
                            program={programs.get(device.programId)}
                        />
                    </li>
                ))}
            </ul>
        </>
    );
}
