'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeviceRow } from '@/features/dashboard/utils/classify-devices';
import DeviceList from './device-list';

type DeviceListCardProps = {
    heading: string;
    description: string;
    emptyMessage: string;
    devices: DeviceRow[];
    programs: Map<number, Program>;
    locationNotes?: Map<number, string>;
};

export default function DeviceListCard({
    heading,
    description,
    emptyMessage,
    devices,
    programs,
    locationNotes,
}: DeviceListCardProps) {
    return (
        <Card className="gap-2">
            <CardHeader>
                <CardTitle className="text-sm">{heading}</CardTitle>
                <p className="text-muted-foreground text-xs">{description}</p>
            </CardHeader>
            <CardContent>
                <DeviceList
                    devices={devices}
                    programs={programs}
                    emptyMessage={emptyMessage}
                    locationNotes={locationNotes}
                />
            </CardContent>
        </Card>
    );
}
