'use client';

import type {
    PlacedDevice,
    PlacedSession,
} from '@/features/dashboard/utils/place-by-site';
import {
    searchMap,
    type MapSearchResult,
} from '@/features/dashboard/utils/search-map';
import type { CoverageStatus } from '@/features/dashboard/utils/parse-coverage-sheets';
import { cn } from '@/utils/cn';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

type MapSearchProps = {
    /** What is on the map now; search never selects a hidden point. */
    sessions: PlacedSession[];
    devices: PlacedDevice[];
    /** Coverage Units drawn on the map; searchable even with no points. */
    units: {
        programId: number;
        unit: string;
        status: CoverageStatus;
        sessionIds: number[];
    }[];
    onPick: (result: MapSearchResult) => void;
    /** false for Stakeholders: no finding a Session by its number. */
    showSessions: boolean;
};

function ResultLabel({ result }: { result: MapSearchResult }) {
    const t = useTranslations('MapSection');
    const count =
        result.layer === 'specimens'
            ? t('selectedSessions', { count: result.ids.length })
            : t('selectedDevices', { count: result.ids.length });
    switch (result.kind) {
        case 'place':
            return (
                <>
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                            {result.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {count}
                        </span>
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                        {[result.level, ...result.context].join(' · ')}
                    </span>
                </>
            );
        case 'site':
            return (
                <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate">
                        <span className="font-medium">
                            {t('searchSite', { id: result.siteId })}
                        </span>{' '}
                        <span className="text-muted-foreground text-xs">
                            {result.name}
                        </span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {count}
                    </span>
                </span>
            );
        case 'session':
            return (
                <span className="font-medium">
                    {t('sessionLabel', { id: result.id })}
                </span>
            );
        case 'unit':
            return (
                <>
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                            {result.unit.unit}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {count}
                        </span>
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                        {t('searchUnit', {
                            status: t(`coverageStatus.${result.status}`),
                        })}
                    </span>
                </>
            );
        case 'device':
            return (
                <span className="font-medium">
                    {t('deviceLabel', { id: result.id })}
                </span>
            );
    }
}

/**
 * Finds a place, Site, Session or device on the map; picking one zooms to it
 * and selects it, as clicking it would.
 */
export default function MapSearch({
    sessions,
    devices,
    units,
    onPick,
    showSessions,
}: MapSearchProps) {
    const t = useTranslations('MapSection');
    const listId = useId();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [active, setActive] = useState(0);
    const results = useMemo(
        () =>
            searchMap(query, sessions, devices, units).filter(
                result => showSessions || result.kind !== 'session',
            ),
        [query, sessions, devices, units, showSessions],
    );
    const showList = isOpen && query.trim() !== '';

    const pick = (result: MapSearchResult) => {
        onPick(result);
        setIsOpen(false);
    };

    return (
        <div className="relative w-72">
            <div className="bg-card/95 border-input focus-within:border-ring focus-within:ring-ring/50 flex h-8 items-center gap-1.5 rounded-md border px-2 shadow-sm focus-within:ring-[3px]">
                <Search
                    className="text-muted-foreground size-3.5 shrink-0"
                    aria-hidden="true"
                />
                <input
                    role="combobox"
                    aria-label={t('search')}
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        showList && results[active]
                            ? `${listId}-${active}`
                            : undefined
                    }
                    value={query}
                    placeholder={t('searchPlaceholder')}
                    onChange={event => {
                        setQuery(event.target.value);
                        setActive(0);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setIsOpen(false)}
                    onKeyDown={event => {
                        if (
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowUp'
                        ) {
                            event.preventDefault();
                            setIsOpen(true);
                            const step = event.key === 'ArrowDown' ? 1 : -1;
                            setActive(
                                current =>
                                    (current + step + results.length) %
                                    Math.max(results.length, 1),
                            );
                        } else if (event.key === 'Enter' && results[active]) {
                            event.preventDefault();
                            pick(results[active]);
                        } else if (event.key === 'Escape') {
                            setIsOpen(false);
                        }
                    }}
                    className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                {query && (
                    <button
                        type="button"
                        aria-label={t('searchClear')}
                        onClick={() => setQuery('')}
                        className="text-muted-foreground hover:text-foreground rounded-sm"
                    >
                        <X className="size-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>
            {showList && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={t('search')}
                    className="bg-popover text-popover-foreground absolute top-9 left-0 w-full overflow-hidden rounded-md border p-1 shadow-md"
                >
                    {results.length === 0 && (
                        <li className="text-muted-foreground px-2 py-1.5 text-sm">
                            {t('searchEmpty')}
                        </li>
                    )}
                    {results.map((result, index) => (
                        <li
                            key={result.key}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            // Before the input's blur closes the list.
                            onMouseDown={event => {
                                event.preventDefault();
                                pick(result);
                            }}
                            onMouseEnter={() => setActive(index)}
                            className={cn(
                                'flex cursor-pointer flex-col rounded-sm px-2 py-1.5 text-sm',
                                index === active && 'bg-accent',
                            )}
                        >
                            <ResultLabel result={result} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
