'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    HIDDEN_BY_DEFAULT_PROGRAM_IDS,
    useDashboardFilters,
} from '@/features/dashboard/hooks/use-dashboard-filters';
import { programSeriesColor } from '@/features/dashboard/utils/series-colors';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ProgramFilter({ programs }: { programs: Program[] }) {
    const t = useTranslations('Filters');
    const [{ exclude }, setFilters] = useDashboardFilters();
    const excluded = new Set(exclude);
    const allProgramIds = programs.map(program => program.programId);
    const selectedCount = programs.filter(
        program => !excluded.has(program.programId),
    ).length;

    function toggle(programId: number) {
        setFilters({
            exclude: excluded.has(programId)
                ? exclude.filter(id => id !== programId)
                : [...exclude, programId],
        });
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                    {t('programsSummary', {
                        selected: selectedCount,
                        total: programs.length,
                    })}
                    <ChevronDown />
                </Button>
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
    );
}
