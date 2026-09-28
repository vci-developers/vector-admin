'use client';

import MonthPicker from '@/components/ui/month-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import {
    RANGE_PRESETS,
    type RangePreset,
    type ResolvedRange,
} from '@/features/dashboard/utils/resolve-reporting-range';
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
        setFilters(
            next === 'custom'
                ? { range: next, from: range.from ?? range.to, to: range.to }
                : { range: next, from: null, to: null },
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={preset}
                onValueChange={selectPreset}
                aria-label={t('range')}
            >
                {RANGE_PRESETS.map(value => (
                    <ToggleGroupItem key={value} value={value} className="px-3">
                        {t(`presets.${value}`)}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {preset === 'custom' && (
                <div className="flex items-center gap-2">
                    <MonthPicker
                        label={t('from')}
                        value={range.from ?? range.to}
                        max={range.to}
                        onChange={from => setFilters({ from })}
                    />
                    <span className="text-muted-foreground text-sm">
                        {t('to')}
                    </span>
                    <MonthPicker
                        label={t('to')}
                        value={range.to}
                        min={range.from}
                        max={currentMonth}
                        onChange={to => setFilters({ to })}
                    />
                </div>
            )}
        </div>
    );
}
