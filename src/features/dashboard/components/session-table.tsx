'use client';

import type { ProgramSessions } from '@/api/program-sessions/validation/program-sessions-schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    buildPlaceOptions,
    filterSessionRows,
    medianGap,
    MISSING_OPTIONS,
    missingOf,
    nextSort,
    NO_FILTERS,
    sortSessionRows,
    stateOf,
    type SessionFilters,
    type SessionSort,
    type SortColumn,
} from '@/features/dashboard/utils/session-table';
import { cn } from '@/utils/cn';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Clock,
    ListFilter,
    Search,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
import PlaceFilterMenu from './place-filter-menu';

type SessionRow = ProgramSessions['sessions'][number];

function MissingFields({ session }: { session: SessionRow }) {
    const t = useTranslations('Sessions');
    const tFields = useTranslations('Fields');
    const { missing } = session;
    const labels = [
        missing.species > 0 &&
            t('missingSpecies', {
                count: missing.species,
                total: session.specimenCount,
            }),
        missing.captureDate && tFields('captureDate'),
        missing.geolocation && tFields('geolocation'),
        missing.operatorId && tFields('operatorId'),
    ].filter((label): label is string => Boolean(label));

    if (labels.length === 0) {
        return (
            <span className="text-muted-foreground">{t('noneMissing')}</span>
        );
    }
    return (
        <div className="flex flex-wrap gap-1">
            {labels.map(label => (
                <Badge key={label} variant="outline">
                    {label}
                </Badge>
            ))}
        </div>
    );
}

/** Median seconds from one image to the next, or why there is none. */
function TimeBetweenImages({ session }: { session: SessionRow }) {
    const t = useTranslations('Sessions');
    const formatter = useFormatter();
    const median = medianGap(session);
    return median === null ? (
        <span className="text-muted-foreground">
            {t('noGap')} · {t('imageCount', { count: session.handling.images })}
        </span>
    ) : (
        t('medianGap', {
            seconds: formatter.number(median, { maximumFractionDigits: 1 }),
        })
    );
}

type FilterOption<Value> = { value: Value; label: ReactNode; count: number };

/** Checklist of a column's values, each with its count; none ticked = all. */
function FilterMenu<Value extends string | number>({
    column,
    options,
    selected,
    onChange,
    container,
}: {
    column: string;
    options: FilterOption<Value>[];
    selected: Value[];
    onChange: (selected: Value[]) => void;
    container: HTMLElement | null;
}) {
    const t = useTranslations('Sessions');
    const formatter = useFormatter();
    const isActive = selected.length > 0;
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
                className="flex max-h-80 w-64 flex-col gap-0.5 overflow-auto p-2"
            >
                <div className="flex items-center justify-between px-2 pb-1">
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
                {options.map(option => {
                    const isChecked = selected.includes(option.value);
                    return (
                        <label
                            key={option.value}
                            className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm select-none"
                        >
                            <Checkbox
                                checked={isChecked}
                                onCheckedChange={() =>
                                    onChange(
                                        isChecked
                                            ? selected.filter(
                                                  v => v !== option.value,
                                              )
                                            : [...selected, option.value],
                                    )
                                }
                            />
                            <span className="flex-1 truncate">
                                {option.label}
                            </span>
                            <span className="text-muted-foreground text-xs tabular-nums">
                                {formatter.number(option.count)}
                            </span>
                        </label>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

/** A header that sorts on click (asc, desc, then the default order). */
function SortHead({
    column,
    label,
    sort,
    onSort,
    filter,
}: {
    column: SortColumn;
    label: string;
    sort: SessionSort;
    onSort: (column: SortColumn) => void;
    filter?: ReactNode;
}) {
    const t = useTranslations('Sessions');
    const direction = sort?.column === column ? sort.direction : null;
    const Icon =
        direction === 'asc'
            ? ArrowUp
            : direction === 'desc'
              ? ArrowDown
              : ArrowUpDown;
    return (
        <TableHead
            aria-sort={
                direction === 'asc'
                    ? 'ascending'
                    : direction === 'desc'
                      ? 'descending'
                      : 'none'
            }
        >
            <span className="flex items-center gap-0.5">
                <button
                    type="button"
                    onClick={() => onSort(column)}
                    title={t('sortBy', { column: label })}
                    className="hover:text-foreground focus-visible:ring-ring/50 -ml-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 whitespace-nowrap outline-none focus-visible:ring-[3px]"
                >
                    {label}
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            'size-3.5',
                            direction
                                ? 'text-foreground'
                                : 'text-muted-foreground/60',
                        )}
                    />
                </button>
                {filter}
            </span>
        </TableHead>
    );
}

function countBy<Value>(values: Value[]): Map<Value, number> {
    const counts = new Map<Value, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
}

/**
 * The Session panel's table: every column sorts, and State, Device, Site and
 * Missing filter by the values present. Options and counts come from all the
 * period's Sessions, not just the ones currently shown.
 */
export default function SessionTable({ rows }: { rows: SessionRow[] }) {
    const t = useTranslations('Sessions');
    const tFields = useTranslations('Fields');
    const formatter = useFormatter();
    const [sort, setSort] = useState<SessionSort>(null);
    const [filters, setFilters] = useState<SessionFilters>(NO_FILTERS);
    // Filter menus render in here, inside the Session sheet, so they scroll.
    const [menuRoot, setMenuRoot] = useState<HTMLDivElement | null>(null);
    const formatDate = (timestamp: number) =>
        formatter.dateTime(timestamp, { dateStyle: 'medium' });
    const formatDateTime = (timestamp: number) =>
        formatter.dateTime(timestamp, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });

    const shown = useMemo(
        () => sortSessionRows(filterSessionRows(rows, filters), sort),
        [rows, filters, sort],
    );
    const options = useMemo(() => {
        const states = countBy(rows.map(stateOf));
        const devices = countBy(rows.map(r => r.deviceId));
        const missing = countBy(rows.flatMap(missingOf));
        const byCount = <V,>(a: FilterOption<V>, b: FilterOption<V>) =>
            b.count - a.count;
        return {
            states: [...states].map(([value, count]) => ({
                value,
                count,
                label: t(`states.${value}`),
            })),
            devices: [...devices]
                .map(([value, count]) => ({
                    value,
                    count,
                    label: t('deviceOption', { id: value }),
                }))
                .sort(byCount),
            places: buildPlaceOptions(rows),
            missing: MISSING_OPTIONS.filter(m => missing.has(m)).map(m => ({
                value: m,
                count: missing.get(m) ?? 0,
                label: m === 'none' ? t('missingNone') : tFields(m),
            })),
        };
    }, [rows, t, tFields]);

    const isFiltered = Object.values(filters).some(list => list.length > 0);
    const onSort = (column: SortColumn) =>
        setSort(current => nextSort(current, column));
    const setFilter =
        <Key extends keyof SessionFilters>(key: Key) =>
        (selected: SessionFilters[Key]) =>
            setFilters(current => ({ ...current, [key]: selected }));
    const head = (column: SortColumn, label: string, filter?: ReactNode) => (
        <SortHead
            column={column}
            label={label}
            sort={sort}
            onSort={onSort}
            filter={filter}
        />
    );

    return (
        <div ref={setMenuRoot} className="flex min-h-0 flex-1 flex-col gap-1">
            {/* Always rendered, so sorting or filtering never shifts the table. */}
            <div className="text-muted-foreground flex h-9 items-center justify-between gap-2 px-2 text-xs">
                <label className="border-input focus-within:border-ring focus-within:ring-ring/50 flex h-8 w-72 items-center gap-1.5 rounded-md border px-2 focus-within:ring-[3px]">
                    <Search className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t('search')}</span>
                    <input
                        type="search"
                        value={filters.search}
                        onChange={event =>
                            setFilter('search')(event.target.value)
                        }
                        placeholder={t('searchPlaceholder')}
                        className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                </label>
                <span aria-live="polite" className="ml-auto">
                    {t('showing', {
                        shown: formatter.number(shown.length),
                        total: formatter.number(rows.length),
                    })}
                </span>
                <span className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="xs"
                        disabled={!isFiltered}
                        onClick={() => setFilters(NO_FILTERS)}
                    >
                        {t('clearFilters')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="xs"
                        disabled={!sort}
                        onClick={() => setSort(null)}
                    >
                        {t('clearSort')}
                    </Button>
                </span>
            </div>
            <Table containerClassName="min-h-0 flex-1 overflow-auto">
                <TableHeader className="bg-popover sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                    <TableRow>
                        {head('sessionId', t('session'))}
                        {head(
                            'state',
                            t('state'),
                            <FilterMenu
                                column={t('state')}
                                options={options.states}
                                selected={filters.states}
                                container={menuRoot}
                                onChange={setFilter('states')}
                            />,
                        )}
                        {head(
                            'deviceId',
                            t('device'),
                            <FilterMenu
                                column={t('device')}
                                options={options.devices}
                                selected={filters.deviceIds}
                                container={menuRoot}
                                onChange={setFilter('deviceIds')}
                            />,
                        )}
                        {head(
                            'site',
                            t('site'),
                            <PlaceFilterMenu
                                column={t('site')}
                                options={options.places}
                                selected={filters.places}
                                container={menuRoot}
                                onChange={setFilter('places')}
                            />,
                        )}
                        {head('collectorName', t('enteredBy'))}
                        {head('createdAt', t('dateEntered'))}
                        {head('collectionDate', t('collected'))}
                        {head('submittedAt', t('submitted'))}
                        {head('timeBetweenImages', t('timeBetweenImages'))}
                        {head(
                            'missing',
                            t('missing'),
                            <FilterMenu
                                column={t('missing')}
                                options={options.missing}
                                selected={filters.missing}
                                container={menuRoot}
                                onChange={setFilter('missing')}
                            />,
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {shown.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={10}
                                className="text-muted-foreground py-6 text-center"
                            >
                                {t('noMatches')}
                            </TableCell>
                        </TableRow>
                    )}
                    {shown.map(row => (
                        <TableRow
                            key={row.sessionId}
                            className={
                                row.isCertified ? undefined : 'bg-warning/10'
                            }
                        >
                            <TableCell className="tabular-nums">
                                {row.sessionId}
                            </TableCell>
                            <TableCell>
                                {row.isCertified ? (
                                    <Badge variant="outline">
                                        {t(`states.${row.state ?? 'UNKNOWN'}`)}
                                    </Badge>
                                ) : (
                                    <Badge
                                        variant="outline"
                                        className="border-warning text-foreground gap-1"
                                    >
                                        <Clock aria-hidden="true" />
                                        {t(`states.${row.state ?? 'UNKNOWN'}`)}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="tabular-nums">
                                {row.deviceId}
                            </TableCell>
                            <TableCell>
                                {row.siteName ?? (
                                    <span className="text-muted-foreground">
                                        {t('unnamedSite')}
                                    </span>
                                )}{' '}
                                <span className="text-muted-foreground text-xs tabular-nums">
                                    #{row.siteId}
                                </span>
                            </TableCell>
                            <TableCell>
                                {row.collectorName || (
                                    <span className="text-muted-foreground">
                                        {t('noCollector')}
                                    </span>
                                )}
                                {row.collectorTitle && (
                                    <span className="text-muted-foreground block text-xs">
                                        {row.collectorTitle}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {row.createdAt === null ? (
                                    <span className="text-muted-foreground">
                                        {t('noDate')}
                                    </span>
                                ) : (
                                    formatDateTime(row.createdAt)
                                )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {row.collectionDate === null ? (
                                    <span className="text-muted-foreground">
                                        {t('noDate')}
                                    </span>
                                ) : (
                                    formatDate(row.collectionDate)
                                )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                {formatDate(row.submittedAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                                <TimeBetweenImages session={row} />
                            </TableCell>
                            <TableCell>
                                <MissingFields session={row} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
