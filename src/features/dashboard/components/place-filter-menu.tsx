'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { PlaceOption } from '@/features/dashboard/utils/session-table';
import { cn } from '@/utils/cn';
import { ChevronRight, ListFilter } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type PlaceFilterMenuProps = {
    column: string;
    options: PlaceOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    container: HTMLElement | null;
};

/**
 * The Site column's filter: the Site hierarchy as a tree that opens a level at
 * a time. Ticking a place (a District, say) keeps every Site beneath it.
 */
export default function PlaceFilterMenu({
    column,
    options,
    selected,
    onChange,
    container,
}: PlaceFilterMenuProps) {
    const t = useTranslations('Sessions');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const { childrenOf, parentOf } = useMemo(() => {
        const children = Map.groupBy(options, option => option.parentKey);
        const parents = new Map(
            options.map(option => [option.key, option.parentKey]),
        );
        return { childrenOf: children, parentOf: parents };
    }, [options]);

    const isActive = selected.length > 0;
    const hasSelectedAncestor = (key: string) => {
        for (
            let parent = parentOf.get(key) ?? null;
            parent !== null;
            parent = parentOf.get(parent) ?? null
        ) {
            if (selected.includes(parent)) return true;
        }
        return false;
    };
    const hasSelectedDescendant = (key: string) =>
        selected.some(chosen => chosen !== key && chosen.startsWith(`${key}/`));
    const toggleExpanded = (key: string) =>
        setExpanded(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    // Ticking a place replaces any picks beneath it, which it now covers.
    const toggleSelected = (key: string) =>
        onChange(
            selected.includes(key)
                ? selected.filter(chosen => chosen !== key)
                : [
                      ...selected.filter(
                          chosen => !chosen.startsWith(`${key}/`),
                      ),
                      key,
                  ],
        );

    const renderLevel = (parentKey: string | null, depth: number) =>
        (childrenOf.get(parentKey) ?? []).map(option => (
            <PlaceRow
                key={option.key}
                option={option}
                depth={depth}
                isExpanded={expanded.has(option.key)}
                hasChildren={childrenOf.has(option.key)}
                checked={
                    selected.includes(option.key) ||
                    hasSelectedAncestor(option.key)
                        ? true
                        : hasSelectedDescendant(option.key)
                          ? 'indeterminate'
                          : false
                }
                isCovered={hasSelectedAncestor(option.key)}
                onExpand={() => toggleExpanded(option.key)}
                onToggle={() => toggleSelected(option.key)}
            >
                {expanded.has(option.key) && renderLevel(option.key, depth + 1)}
            </PlaceRow>
        ));

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t('filterColumn', { column })}
                    className={cn(
                        isActive
                            ? 'bg-primary/15 text-foreground'
                            : 'text-muted-foreground',
                    )}
                >
                    <ListFilter />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                container={container}
                align="start"
                className="flex max-h-96 w-80 flex-col gap-0.5 overflow-auto p-2 pt-0"
            >
                {/* Stays in view while a long tree scrolls. */}
                <div className="bg-popover sticky top-0 z-10 flex items-center justify-between px-2 pt-2 pb-1">
                    <span className="text-muted-foreground text-xs font-medium">
                        {column}
                    </span>
                    <Button
                        variant="ghost"
                        size="xs"
                        disabled={!isActive}
                        onClick={() => onChange([])}
                    >
                        {t('filterAll')}
                    </Button>
                </div>
                <ul role="tree" aria-label={column}>
                    {renderLevel(null, 0)}
                </ul>
            </PopoverContent>
        </Popover>
    );
}

function PlaceRow({
    option,
    depth,
    isExpanded,
    hasChildren,
    checked,
    isCovered,
    onExpand,
    onToggle,
    children,
}: {
    option: PlaceOption;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    checked: boolean | 'indeterminate';
    /** A place above it is ticked, so it is already kept. */
    isCovered: boolean;
    onExpand: () => void;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    const t = useTranslations('Sessions');
    const formatter = useFormatter();
    const name = option.name || t('unnamedSite');
    return (
        <li
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={checked === true}
        >
            <div
                className="hover:bg-muted flex items-center gap-1 rounded-md py-1 pr-2 text-sm"
                style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
                {hasChildren ? (
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t(
                            isExpanded ? 'collapsePlace' : 'expandPlace',
                            { place: name },
                        )}
                        onClick={onExpand}
                    >
                        <ChevronRight
                            className={cn(
                                'transition-transform',
                                isExpanded && 'rotate-90',
                            )}
                        />
                    </Button>
                ) : (
                    <span className="size-6 shrink-0" aria-hidden="true" />
                )}
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 select-none">
                    <Checkbox
                        checked={checked}
                        disabled={isCovered}
                        onCheckedChange={onToggle}
                    />
                    <span className="min-w-0 flex-1 truncate">
                        {name}{' '}
                        <span className="text-muted-foreground text-xs">
                            {option.siteId === null
                                ? option.level
                                : `#${option.siteId}`}
                        </span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {formatter.number(option.count)}
                    </span>
                </label>
            </div>
            {children && <ul role="group">{children}</ul>}
        </li>
    );
}
