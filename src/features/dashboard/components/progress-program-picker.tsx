'use client';

import type { Program } from '@/api/program/validation/program-schema';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

type ProgressProgramPickerProps = {
    programs: Program[];
    excludedProgramIds: number[];
    onChange: (selectedProgramIds: number[]) => void;
    disabled?: boolean;
};

/** Immediate program selection; the popup stays open for multiple choices. */
export default function ProgressProgramPicker({
    programs,
    excludedProgramIds,
    onChange,
    disabled = false,
}: ProgressProgramPickerProps) {
    const labelId = useId();
    const valueId = useId();
    const excluded = new Set(excludedProgramIds);
    const selected = programs.filter(
        program => !excluded.has(program.programId),
    );
    const selectedIds = new Set(selected.map(program => program.programId));
    const countries = Array.from(
        new Set(selected.map(program => program.country)),
    ).sort();
    const title =
        countries.length === 0
            ? 'Choose programs'
            : countries.length <= 2
              ? countries.join(' + ')
              : 'Multiple countries';
    const subtitle =
        selected.map(program => program.name).join(' · ') ||
        'Select the programs to display';
    const offered = [...programs].sort(
        (a, b) =>
            a.country.localeCompare(b.country) ||
            a.name.localeCompare(b.name) ||
            a.programId - b.programId,
    );

    function toggle(programId: number, checked: boolean) {
        const next = new Set(selectedIds);
        if (checked) next.add(programId);
        else next.delete(programId);
        onChange(
            programs
                .filter(program => next.has(program.programId))
                .map(program => program.programId),
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span
                id={labelId}
                className="text-muted-foreground text-[11px] font-medium"
            >
                Reporting programs
            </span>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled || programs.length === 0}
                        aria-labelledby={`${labelId} ${valueId}`}
                        className="bg-card text-foreground hover:border-primary/40 focus-visible:ring-ring flex min-h-14 w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span id={valueId} className="flex min-w-0 flex-col">
                            <span
                                title={countries.join(', ') || title}
                                className="truncate text-lg leading-snug font-bold tracking-tight"
                            >
                                {title}
                            </span>
                            <span
                                title={subtitle}
                                className="text-muted-foreground mt-0.5 truncate text-xs leading-snug"
                            >
                                {subtitle}
                            </span>
                        </span>
                        <ChevronDown
                            className="text-muted-foreground size-4 shrink-0"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={8}
                    aria-label="Choose reporting programs"
                    className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[360px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-2 shadow-xl shadow-black/8"
                >
                    <fieldset className="min-w-0">
                        <legend className="sr-only">Reporting programs</legend>
                        {offered.map(program => {
                            const checked = selectedIds.has(program.programId);
                            return (
                                <label
                                    key={program.programId}
                                    className={cn(
                                        'hover:bg-muted focus-within:bg-muted flex min-h-[68px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                                        checked && 'bg-primary/5',
                                        disabled &&
                                            'cursor-not-allowed opacity-60',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={event =>
                                            toggle(
                                                program.programId,
                                                event.target.checked,
                                            )
                                        }
                                        className="accent-primary focus-visible:ring-ring size-[18px] shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-foreground text-lg leading-snug font-bold tracking-tight">
                                            {program.country}
                                        </span>
                                        <span className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                                            {program.name}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </fieldset>
                </PopoverContent>
            </Popover>
        </div>
    );
}
