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
import { ChartColumn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { SEGMENT, SEGMENTED } from './panel-header';
import panelStyles from './panel.module.css';
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
                {/* Styled as the internal panels' headers (PanelHeader). */}
                <SheetHeader className={panelStyles.header}>
                    <div className={panelStyles.heading}>
                        <span className={panelStyles.chip}>
                            <ChartColumn
                                className="size-[18px]"
                                aria-hidden="true"
                            />
                        </span>
                        <div className="min-w-0 pr-8">
                            <SheetTitle className={panelStyles.title}>
                                {t('dailyTitle', { title })}
                            </SheetTitle>
                            <SheetDescription
                                className={panelStyles.description}
                            >
                                {t('dailyDescription', {
                                    period: period.label,
                                })}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>
                <div className="flex flex-col gap-4 overflow-auto px-(--d-pad-x) py-5">
                    <ToggleGroup
                        type="single"
                        size="sm"
                        spacing={1}
                        className={SEGMENTED}
                        value={dimension}
                        onValueChange={value => {
                            if (value)
                                onDimensionChange(value as TimelineDimension);
                        }}
                        aria-label={t('chartStackBy')}
                    >
                        {dimensions.map(d => (
                            <ToggleGroupItem
                                key={d}
                                value={d}
                                className={SEGMENT}
                            >
                                {t(`chartDimension.${d}`)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    {timeline && timeline.total > 0 ? (
                        <SelectionChart timeline={timeline} view="bar" scroll />
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
