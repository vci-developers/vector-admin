'use client';

import type { ProgressDistrict } from '@/api/progress/validation/progress-schema';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import { ChevronDown, Search } from 'lucide-react';
import { useId, useState } from 'react';

const fold = (value: string) =>
    value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The chart panel's area choice, searchable by area or country name. */
export default function ProgressAreaPicker({
    areas,
    showCountry,
    selectedKey,
    onChange,
    disabled = false,
}: {
    areas: readonly Pick<ProgressDistrict, 'key' | 'name' | 'country'>[];
    showCountry: boolean;
    selectedKey: string | null;
    onChange: (key: string | null) => void;
    disabled?: boolean;
}) {
    const labelId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const label = (area: (typeof areas)[number]) =>
        showCountry ? `${area.name} · ${area.country}` : area.name;
    const selected = areas.find(area => area.key === selectedKey);
    const matches = areas.filter(area =>
        fold(label(area)).includes(fold(query)),
    );

    function choose(key: string | null) {
        onChange(key);
        setOpen(false);
        setQuery('');
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span
                id={labelId}
                className="text-muted-foreground text-[11px] font-medium"
            >
                Reporting area
            </span>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        aria-labelledby={labelId}
                        className="bg-card text-foreground focus-visible:ring-ring hover:border-primary/40 flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="truncate">
                            {selected ? label(selected) : 'All reporting areas'}
                        </span>
                        <ChevronDown
                            className="text-muted-foreground size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-(--radix-popover-trigger-width) min-w-64 p-2"
                >
                    <div className="relative">
                        <Search
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            autoFocus
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            onKeyDown={event => {
                                if (event.key === 'Enter' && matches[0])
                                    choose(matches[0].key);
                            }}
                            placeholder="Search areas"
                            aria-label="Search reporting areas"
                            className="focus-visible:ring-ring h-9 w-full rounded-md border pr-2 pl-8 text-sm outline-none focus-visible:ring-2"
                        />
                    </div>
                    <ul
                        aria-label="Reporting areas"
                        className="mt-2 max-h-72 overflow-y-auto"
                    >
                        {!query && (
                            <li>
                                <AreaOption
                                    selected={selectedKey === null}
                                    onClick={() => choose(null)}
                                >
                                    All reporting areas
                                </AreaOption>
                            </li>
                        )}
                        {matches.map(area => (
                            <li key={area.key}>
                                <AreaOption
                                    selected={area.key === selectedKey}
                                    onClick={() => choose(area.key)}
                                >
                                    {label(area)}
                                </AreaOption>
                            </li>
                        ))}
                        {matches.length === 0 && (
                            <li className="text-muted-foreground px-2 py-2 text-sm">
                                No areas match “{query}”.
                            </li>
                        )}
                    </ul>
                </PopoverContent>
            </Popover>
        </div>
    );
}

function AreaOption({
    selected,
    onClick,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                'hover:bg-muted focus-visible:bg-muted w-full truncate rounded-md px-2 py-1.5 text-left text-sm outline-none',
                selected && 'text-primary font-semibold',
            )}
        >
            {children}
        </button>
    );
}
