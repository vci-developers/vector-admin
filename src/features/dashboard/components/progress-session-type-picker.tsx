'use client';

import {
    progressSessionTypeSchema,
    type ProgressSessionType,
} from '@/api/progress/validation/progress-schema';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { PROGRESS_SESSION_TYPE_LABELS } from '@/features/dashboard/utils/progress-session-types';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';

const SESSION_TYPES = progressSessionTypeSchema.options;

type ProgressSessionTypePickerProps = {
    selected: ProgressSessionType[];
    onChange: (types: ProgressSessionType[]) => void;
};

/** Which session types every figure counts; at least one stays selected. */
export default function ProgressSessionTypePicker({
    selected,
    onChange,
}: ProgressSessionTypePickerProps) {
    const labelId = useId();
    const valueId = useId();
    const title =
        selected.length === SESSION_TYPES.length
            ? 'All session types'
            : selected
                  .map(type => PROGRESS_SESSION_TYPE_LABELS[type])
                  .join(' + ');

    function toggle(type: ProgressSessionType, checked: boolean) {
        onChange(
            SESSION_TYPES.filter(option =>
                option === type ? checked : selected.includes(option),
            ),
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <span
                id={labelId}
                className="text-muted-foreground text-[11px] font-medium"
            >
                Session types
            </span>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-labelledby={`${labelId} ${valueId}`}
                        className="bg-card text-foreground hover:border-primary/40 focus-visible:ring-ring flex h-15 w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-2"
                    >
                        <span
                            id={valueId}
                            title={title}
                            className="truncate text-lg leading-snug font-bold tracking-tight"
                        >
                            {title}
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
                    aria-label="Choose session types"
                    className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2 shadow-xl shadow-black/8"
                >
                    <fieldset className="grid min-w-0 gap-1">
                        <legend className="sr-only">Session types</legend>
                        {SESSION_TYPES.map(type => {
                            const checked = selected.includes(type);
                            const last = checked && selected.length === 1;
                            return (
                                <label
                                    key={type}
                                    className={cn(
                                        'hover:bg-muted focus-within:bg-muted flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors',
                                        checked && 'bg-primary/5',
                                        last && 'cursor-not-allowed',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={last}
                                        onChange={event =>
                                            toggle(type, event.target.checked)
                                        }
                                        className="accent-primary focus-visible:ring-ring size-[18px] shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                    />
                                    {PROGRESS_SESSION_TYPE_LABELS[type]}
                                </label>
                            );
                        })}
                    </fieldset>
                </PopoverContent>
            </Popover>
        </div>
    );
}
