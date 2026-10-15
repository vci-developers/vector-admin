'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import { programSeriesColor } from '@/features/dashboard/utils/series-colors';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import styles from './internal-toolbar.module.css';

export default function ProgramFilter({ programs }: { programs: Program[] }) {
    const t = useTranslations('Filters');
    const [{ exclude }, setFilters] = useDashboardFilters();
    const excluded = new Set(exclude);
    const allProgramIds = programs.map(program => program.programId);
    const selected = programs.filter(
        program => !excluded.has(program.programId),
    );
    const selectedCount = selected.length;
    const countries = [...new Set(selected.map(p => p.country))].sort();
    const title =
        countries.length === 0
            ? t('noPrograms')
            : selectedCount === programs.length && programs.length > 1
              ? t('allPrograms')
              : countries.join(', ');
    const labelId = useId();
    const valueId = useId();

    function toggle(programId: number) {
        setFilters({
            exclude: excluded.has(programId)
                ? exclude.filter(id => id !== programId)
                : [...exclude, programId],
        });
    }

    return (
        <div className={styles.field}>
            <span id={labelId} className={styles.label}>
                {t('programs')}
            </span>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-labelledby={`${labelId} ${valueId}`}
                        className={styles.trigger}
                    >
                        <span id={valueId} className={styles.triggerValue}>
                            <span
                                title={countries.join(', ')}
                                className={styles.triggerTitle}
                            >
                                {title}
                            </span>
                            <span className={styles.triggerSubtitle}>
                                {t('programsSummary', {
                                    selected: selectedCount,
                                    total: programs.length,
                                })}
                            </span>
                        </span>
                        <ChevronDown
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-2">
                    <div className="flex items-center justify-between gap-2 pb-1 pl-2">
                        <span
                            id="program-filter-legend"
                            className="text-muted-foreground text-xs font-medium"
                        >
                            {t('programs')}
                        </span>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={exclude.length === 0}
                                onClick={() => setFilters({ exclude: [] })}
                            >
                                {t('selectAll')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={selectedCount === 0}
                                onClick={() =>
                                    setFilters({ exclude: allProgramIds })
                                }
                            >
                                {t('deselectAll')}
                            </Button>
                        </div>
                    </div>
                    <div
                        role="group"
                        aria-labelledby="program-filter-legend"
                        className="flex flex-col"
                    >
                        {programs.map(program => (
                            <label
                                key={program.programId}
                                className={cn(
                                    'hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors select-none',
                                    excluded.has(program.programId) &&
                                        'text-muted-foreground',
                                )}
                            >
                                <Checkbox
                                    checked={!excluded.has(program.programId)}
                                    onCheckedChange={() =>
                                        toggle(program.programId)
                                    }
                                />
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'size-2 shrink-0 rounded-full transition-opacity',
                                        excluded.has(program.programId) &&
                                            'opacity-30',
                                    )}
                                    style={{
                                        background: programSeriesColor(
                                            program.programId,
                                            allProgramIds,
                                        ),
                                    }}
                                />
                                <span className="flex flex-1 flex-col">
                                    {program.country}
                                    <span className="text-muted-foreground text-xs">
                                        {program.name}
                                        {HIDDEN_BY_DEFAULT_PROGRAM_IDS.includes(
                                            program.programId,
                                        ) && ` · ${t('hiddenByDefault')}`}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 w-full"
                        onClick={() => setFilters({ exclude: null })}
                    >
                        {t('resetPrograms')}
                    </Button>
                </PopoverContent>
            </Popover>
        </div>
    );
}
