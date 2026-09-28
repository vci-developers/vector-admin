'use client';

import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

/** Months are `YYYY-MM` strings; `min`/`max` bound the selectable range. */
type MonthPickerProps = {
    value: string;
    onChange: (month: string) => void;
    min?: string;
    max?: string;
    label: string;
};

const toMonthKey = (year: number, monthIndex: number) =>
    `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

const monthDate = (year: number, monthIndex: number) =>
    new Date(Date.UTC(year, monthIndex, 1));

export default function MonthPicker({
    value,
    onChange,
    min,
    max,
    label,
}: MonthPickerProps) {
    const t = useTranslations('MonthPicker');
    const formatter = useFormatter();
    const [open, setOpen] = useState(false);
    const [selectedYear, selectedMonth] = value.split('-').map(Number);
    const [viewYear, setViewYear] = useState(selectedYear);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (nextOpen) setViewYear(selectedYear);
    }

    function isDisabled(monthIndex: number) {
        const month = toMonthKey(viewYear, monthIndex);
        return (!!min && month < min) || (!!max && month > max);
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    aria-label={label}
                    className="justify-start gap-2"
                >
                    <CalendarIcon />
                    {formatter.dateTime(
                        monthDate(selectedYear, selectedMonth - 1),
                        { month: 'long', year: 'numeric', timeZone: 'UTC' },
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
                <div className="mb-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewYear(year => year - 1)}
                        disabled={!!min && viewYear <= Number(min.slice(0, 4))}
                        aria-label={t('previousYear')}
                    >
                        <ChevronLeft />
                    </Button>
                    <span className="text-sm font-medium">{viewYear}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewYear(year => year + 1)}
                        disabled={!!max && viewYear >= Number(max.slice(0, 4))}
                        aria-label={t('nextYear')}
                    >
                        <ChevronRight />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }, (_, monthIndex) => (
                        <Button
                            key={monthIndex}
                            variant={
                                viewYear === selectedYear &&
                                monthIndex === selectedMonth - 1
                                    ? 'default'
                                    : 'ghost'
                            }
                            size="sm"
                            disabled={isDisabled(monthIndex)}
                            onClick={() => {
                                onChange(toMonthKey(viewYear, monthIndex));
                                setOpen(false);
                            }}
                        >
                            {formatter.dateTime(
                                monthDate(viewYear, monthIndex),
                                {
                                    month: 'short',
                                    timeZone: 'UTC',
                                },
                            )}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
