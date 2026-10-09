'use client';

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    buildSelectionTimeline,
    type TimelineDimension,
} from '@/features/dashboard/utils/build-selection-timeline';
import type { MonthKey } from '@/features/dashboard/utils/month-key';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import SelectionChart from './selection-chart';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** What the panel shows: the whole map or what is selected. */
    title: string;
    period: { from: MonthKey; to: MonthKey; label: string };
    sessions: Parameters<typeof buildSelectionTimeline>[0]['sessions'];
    dimensions: TimelineDimension[];
    dimension: TimelineDimension;
    onDimensionChange: (dimension: TimelineDimension) => void;
    ranking: string[];
};

/**
 * The panel's chart opened out from the right, a bar per day of the period,
 * so it shows which days specimens were collected and which were quiet.
 */
export default function DailyChartSheet({
    open,
    onOpenChange,
    title,
    period,
    sessions,
    dimensions,
    dimension,
    onDimensionChange,
    ranking,
}: Props) {
    const t = useTranslations('MapSection');
    const timeline = useMemo(
        () =>
            open
                ? buildSelectionTimeline({
                      sessions,
                      period,
                      dimension,
                      ranking,
                      granularity: 'day',
                  })
                : null,
        [open, sessions, period, dimension, ranking],
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                closeLabel={t('dailyClose')}
                className="w-full sm:max-w-[min(96vw,64rem)]"
            >
                <SheetHeader className="border-b">
                    <SheetTitle>{t('dailyTitle', { title })}</SheetTitle>
                    <SheetDescription>
                        {t('dailyDescription', { period: period.label })}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 overflow-auto p-4">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={dimension}
                        onValueChange={value => {
                            if (value)
                                onDimensionChange(value as TimelineDimension);
                        }}
                        aria-label={t('chartStackBy')}
                        className="self-start"
                    >
                        {dimensions.map(d => (
                            <ToggleGroupItem
                                key={d}
                                value={d}
                                className="px-3 text-xs"
                            >
                                {t(`chartDimension.${d}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    {timeline && timeline.total > 0 ? (
                        <SelectionChart timeline={timeline} view="bar" tall />
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            {t('chartEmpty')}
                        </p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
