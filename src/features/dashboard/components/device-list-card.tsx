'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DeviceRow } from '@/features/dashboard/utils/classify-devices';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import DeviceList from './device-list';

type DeviceListCardProps = {
    heading: string;
    description: string;
    emptyMessage: string;
    devices: DeviceRow[];
    programs: Map<number, Program>;
    locationNotes?: Map<number, string>;
    /** Starts closed; the heading opens and closes the list. */
    collapsible?: boolean;
};

export default function DeviceListCard({
    heading,
    description,
    emptyMessage,
    devices,
    programs,
    locationNotes,
    collapsible = false,
}: DeviceListCardProps) {
    const [isOpen, setIsOpen] = useState(!collapsible);
    const contentId = useId();

    return (
        <Card className="gap-2 py-4">
            <CardHeader className="px-4">
                <CardTitle className="text-sm">
                    {collapsible ? (
                        <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={contentId}
                            onClick={() => setIsOpen(open => !open)}
                            className="focus-visible:ring-ring/50 -ml-1 inline-flex items-center gap-1 rounded-sm pr-1 outline-none focus-visible:ring-[3px]"
                        >
                            <ChevronRight
                                aria-hidden="true"
                                className={
                                    isOpen
                                        ? 'size-4 rotate-90 transition-transform'
                                        : 'size-4 transition-transform'
                                }
                            />
                            {heading}
                        </button>
                    ) : (
                        heading
                    )}
                </CardTitle>
                <p className="text-muted-foreground text-xs">{description}</p>
            </CardHeader>
            {isOpen && (
                <CardContent id={contentId} className="px-2">
                    <DeviceList
                        devices={devices}
                        programs={programs}
                        emptyMessage={emptyMessage}
                        locationNotes={locationNotes}
                    />
                </CardContent>
            )}
        </Card>
    );
}
