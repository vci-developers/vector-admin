'use client';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import {
    monthStartDate,
    type MonthKey,
} from '@/features/dashboard/utils/month-key';
import {
    pickMonths,
    shiftPeriod,
    spanFilters,
    type MonthSpan,
} from '@/features/dashboard/utils/pick-period';
import type {
    RangePreset,
    ResolvedRange,
} from '@/features/dashboard/utils/resolve-reporting-range';
import { cn } from '@/utils/cn';
import {
    CalendarIcon,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

/** The presets listed beside the grid; Month and Custom come from the grid. */
const QUICK_PICKS: RangePreset[] = [
    'last-month',
    'this-month',
    '3m',
    '6m',
    '12m',
    'ytd',
    'all',
];

const monthOf = (year: number, monthIndex: number): MonthKey =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

/**
 * The Reporting Period: one button naming it, with arrows that step it by its
 * own length. It opens quick picks beside a month grid, where a click picks
 * that month and a second click makes a range.
 */
export default function PeriodPicker({
    range,
    currentMonth,
}: {
    range: ResolvedRange;
    currentMonth: MonthKey;
}) {
    const t = useTranslations('Filters');
    const formatter = useFormatter();
    const periodLabel = usePeriodLabel();
    const [{ range: preset }, setFilters] = useDashboardFilters();
    const [open, setOpen] = useState(false);
    // The first month of a range being picked; the next click ends it.
    const [anchor, setAnchor] = useState<MonthKey | null>(null);
    const [hovered, setHovered] = useState<MonthKey | null>(null);
    const [viewYear, setViewYear] = useState(() =>
        Number(range.to.slice(0, 4)),
    );

    // All time has no start; it is a preset, never stepped.
    const span: MonthSpan | null = range.from
        ? { from: range.from, to: range.to }
        : null;
    const previous = span && shiftPeriod(span, -1, currentMonth);
    const next = span && shiftPeriod(span, 1, currentMonth);
    // While a range is being picked, it follows the pointer.
    const shown = anchor ? pickMonths(anchor, hovered ?? anchor) : span;
    const lastYear = Number(currentMonth.slice(0, 4));

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen) {
            setAnchor(null);
            setHovered(null);
            setViewYear(Number(range.to.slice(0, 4)));
        }
    }

    function pickPreset(value: RangePreset) {
        void setFilters({ range: value, from: null, to: null });
        setOpen(false);
    }

    function pickMonth(month: MonthKey) {
        void setFilters(spanFilters(pickMonths(anchor, month)));
        if (anchor) {
            setAnchor(null);
            setOpen(false);
        } else {
            // Applied at once; stays open in case a range is wanted.
            setAnchor(month);
        }
    }

    const stepButton = (
        target: MonthSpan | null,
        direction: 'previous' | 'next',
    ) =>
        preset !== 'all' && (
            <Button
                variant="outline"
                size="icon-sm"
                aria-label={t(`${direction}Period`)}
                disabled={!target}
                onClick={() => target && void setFilters(spanFilters(target))}
            >
                {direction === 'previous' ? <ChevronLeft /> : <ChevronRight />}
            </Button>
        );

    return (
        <div className="flex items-center gap-1">
            {stepButton(previous, 'previous')}
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        aria-label={t('range')}
                        className="gap-2"
                    >
                        <CalendarIcon />
                        {span
                            ? periodLabel(span.from, span.to)
                            : t('presets.all')}
                        <ChevronDown className="opacity-60" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="flex w-auto flex-col gap-3 p-3 sm:flex-row"
                >
                    <ul
                        aria-label={t('quickPicks')}
                        className="flex flex-col gap-0.5 sm:w-36"
                    >
                        {QUICK_PICKS.map(value => (
                            <li key={value}>
                                <Button
                                    variant={
                                        preset === value ? 'secondary' : 'ghost'
                                    }
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => pickPreset(value)}
                                >
                                    {t(`presets.${value}`)}
                                </Button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-col gap-2 sm:border-l sm:pl-3">
                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('previousYear')}
                                onClick={() => setViewYear(year => year - 1)}
                            >
                                <ChevronLeft />
                            </Button>
                            <span className="text-sm font-medium">
                                {viewYear}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('nextYear')}
                                disabled={viewYear >= lastYear}
                                onClick={() => setViewYear(year => year + 1)}
                            >
                                <ChevronRight />
                            </Button>
                        </div>
                        <div
                            className="grid grid-cols-3 gap-1"
                            onMouseLeave={() => setHovered(null)}
                        >
                            {Array.from({ length: 12 }, (_, monthIndex) => {
                                const month = monthOf(viewYear, monthIndex);
                                const inside =
                                    !!shown &&
                                    month >= shown.from &&
                                    month <= shown.to;
                                const isEnd =
                                    !!shown &&
                                    (month === shown.from ||
                                        month === shown.to);
                                return (
                                    <Button
                                        key={month}
                                        variant={isEnd ? 'default' : 'ghost'}
                                        size="sm"
                                        aria-pressed={inside}
                                        disabled={month > currentMonth}
                                        className={cn(
                                            inside &&
                                                !isEnd &&
                                                'bg-primary/15 hover:bg-primary/25',
                                        )}
                                        onMouseEnter={() => setHovered(month)}
                                        onFocus={() => setHovered(month)}
                                        onClick={() => pickMonth(month)}
                                    >
                                        {formatter.dateTime(
                                            monthStartDate(month),
                                            { month: 'short', timeZone: 'UTC' },
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                        <p
                            aria-live="polite"
                            className="text-muted-foreground max-w-48 text-xs"
                        >
                            {anchor ? t('pickRangeEnd') : t('pickMonth')}
                        </p>
                    </div>
                </PopoverContent>
            </Popover>
            {stepButton(next, 'next')}
        </div>
    );
}
