'use client';

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { PlaceOption } from '@/features/dashboard/utils/build-place-options';
import { cn } from '@/utils/cn';
import { ChevronDown, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

const fold = (value: string) =>
    value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The panel's place choice, as on the Stakeholder dashboard: searchable by
 * place or country, and naming whatever the map has selected.
 */
export default function PlacePicker({
    options,
    selectedKey,
    selectionLabel,
    onChange,
}: {
    options: readonly PlaceOption[];
    selectedKey: string | null;
    /** What a selection that names no place (points) is called. */
    selectionLabel: string | null;
    onChange: (option: PlaceOption | null) => void;
}) {
    const t = useTranslations('MapSection');
    const labelId = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const kindLabel = (option: PlaceOption) =>
        option.kind === 'unit'
            ? t('searchUnit', {
                  status: t(`coverageStatus.${option.unit.status}`),
              })
            : t(`placeKind.${option.kind}`);
    const context = (option: PlaceOption) =>
        [kindLabel(option), option.country].filter(Boolean).join(' · ');
    const selected = options.find(option => option.key === selectedKey);
    const matches = options.filter(option =>
        fold(`${option.name} ${option.country ?? ''}`).includes(fold(query)),
    );
    const all = t('placeAll');

    function choose(option: PlaceOption | null) {
        onChange(option);
        setOpen(false);
        setQuery('');
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span
                id={labelId}
                className="text-muted-foreground text-[11px] font-medium"
            >
                {t('placeLabel')}
            </span>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-labelledby={labelId}
                        className="bg-card text-foreground focus-visible:ring-ring hover:border-primary/40 flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2"
                    >
                        <span className="truncate">
                            {selected?.name ?? selectionLabel ?? all}
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
                                    choose(matches[0]);
                            }}
                            placeholder={t('placeSearch')}
                            aria-label={t('placeSearch')}
                            className="focus-visible:ring-ring h-9 w-full rounded-md border pr-2 pl-8 text-sm outline-none focus-visible:ring-2"
                        />
                    </div>
                    <ul
                        aria-label={t('placeLabel')}
                        className="mt-2 max-h-72 overflow-y-auto"
                    >
                        {!query && (
                            <li>
                                <PlaceButton
                                    selected={
                                        selectedKey === null && !selectionLabel
                                    }
                                    onClick={() => choose(null)}
                                >
                                    {all}
                                </PlaceButton>
                            </li>
                        )}
                        {matches.map(option => (
                            <li key={option.key}>
                                <PlaceButton
                                    selected={option.key === selectedKey}
                                    onClick={() => choose(option)}
                                >
                                    <span className="block truncate">
                                        {option.name}
                                    </span>
                                    <span className="text-muted-foreground block truncate text-xs font-normal">
                                        {context(option)}
                                    </span>
                                </PlaceButton>
                            </li>
                        ))}
                        {matches.length === 0 && (
                            <li className="text-muted-foreground px-2 py-2 text-sm">
                                {t('placeEmpty', { query })}
                            </li>
                        )}
                    </ul>
                </PopoverContent>
            </Popover>
        </div>
    );
}

function PlaceButton({
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
