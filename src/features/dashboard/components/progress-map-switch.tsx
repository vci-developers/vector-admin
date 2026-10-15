import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

/** A labelled on/off switch in the Stakeholder map's filters. */
export default function ProgressMapSwitch({
    id,
    checked,
    onToggle,
    children,
}: {
    id: string;
    checked: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        // A label around the button makes the whole row toggle it.
        <label className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={id}
                onClick={onToggle}
                className={cn(
                    'focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors outline-none focus-visible:ring-2',
                    checked ? 'bg-primary border-primary' : 'bg-muted',
                )}
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'bg-card absolute top-0.5 left-0.5 size-3.5 rounded-full shadow-xs transition-transform',
                        checked && 'translate-x-4',
                    )}
                />
            </button>
            <span id={id} className="min-w-0 leading-snug">
                {children}
            </span>
        </label>
    );
}
