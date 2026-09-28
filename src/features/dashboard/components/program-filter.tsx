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
            <PopoverContent align="start" className="w-72 p-2">
                <fieldset className="flex flex-col">
                    <legend className="text-muted-foreground px-2 pb-1 text-xs font-medium">
                        {t('programs')}
                    </legend>
                    {programs.map(program => (
                        <label
                            key={program.programId}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                        >
                            <Checkbox
                                checked={!excluded.has(program.programId)}
                                onCheckedChange={() =>
                                    toggle(program.programId)
                                }
                            />
                            <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                    background: programSeriesColor(
                                        program.programId,
                                        allProgramIds,
                                    ),
                                }}
                            />
                            <span className="flex-1">{program.name}</span>
                            {HIDDEN_BY_DEFAULT_PROGRAM_IDS.includes(
                                program.programId,
                            ) && (
                                <span className="text-muted-foreground text-xs">
                                    {t('hiddenByDefault')}
                                </span>
                            )}
                        </label>
                    ))}
                </fieldset>
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
