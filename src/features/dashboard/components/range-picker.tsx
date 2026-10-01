'use client';

import { Button } from '@/components/ui/button';
import MonthPicker from '@/components/ui/month-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import {
    RANGE_PRESETS,
    type RangePreset,
    type ResolvedRange,
} from '@/features/dashboard/utils/resolve-reporting-range';
import { addMonths } from '@/features/dashboard/utils/month-key';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function RangePicker({
    range,
    currentMonth,
}: {
    range: ResolvedRange;
    currentMonth: string;
}) {
    const t = useTranslations('Filters');
    const [{ range: preset }, setFilters] = useDashboardFilters();

    function selectPreset(value: string) {
        // An empty value means the active item was clicked again; keep it.
        if (!value) return;
        const next = value as RangePreset;
        // Month and Custom start from the period on screen.
        setFilters(
            next === 'custom'
                ? { range: next, from: range.from ?? range.to, to: range.to }
                : next === 'month'
                  ? { range: next, from: null, to: range.to }
                  : { range: next, from: null, to: null },
        );
    }

    const from = range.from ?? range.to;

    return (
        <div className="flex max-w-full flex-wrap items-center gap-2">
            {/* The buttons scroll on their own at phone width instead of the page. */}
            <div className="max-w-full overflow-x-auto">
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={preset}
                    onValueChange={selectPreset}
                    aria-label={t('range')}
                >
                    {RANGE_PRESETS.map(value => (
                        <ToggleGroupItem
                            key={value}
                            value={value}
                            className="px-3"
                        >
                            {t(`presets.${value}`)}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>
            {preset === 'month' && (
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('previousMonth')}
                        onClick={() =>
                            setFilters({ to: addMonths(range.to, -1) })
                        }
                    >
                        <ChevronLeft />
                    </Button>
                    <MonthPicker
                        label={t('month')}
                        value={range.to}
                        max={currentMonth}
                        onChange={to => setFilters({ to })}
                    />
                    <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('nextMonth')}
                        disabled={range.to >= currentMonth}
                        onClick={() =>
                            setFilters({ to: addMonths(range.to, 1) })
                        }
                    >
                        <ChevronRight />
                    </Button>
                </div>
            )}
            {preset === 'custom' && (
                <div className="flex items-center gap-2">
                    {/* Either end can be picked first; the other follows. */}
                    <MonthPicker
                        label={t('from')}
                        value={from}
                        max={currentMonth}
                        onChange={next =>
                            setFilters({
                                from: next,
                                to: next > range.to ? next : range.to,
                            })
                        }
                    />
                    <span className="text-muted-foreground text-sm">
                        {t('to')}
                    </span>
                    <MonthPicker
                        label={t('to')}
                        value={range.to}
                        max={currentMonth}
                        onChange={next =>
                            setFilters({
                                to: next,
                                from: next < from ? next : from,
                            })
                        }
                    />
                </div>
            )}
        </div>
    );
}
