'use client';

import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FIELDS, METRICS } from '@/features/dashboard/utils/metric-definitions';
import {
    programLocationKey,
    type LocationRow,
    type SummaryRow,
} from '@/features/dashboard/utils/summary-rows';
import { programTitle } from '@/features/dashboard/utils/program-title';
import { cycleLabel } from '@/features/dashboard/utils/cycle-label';
import { cn } from '@/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import MetricInfo from './metric-info';
import MetricValue from './metric-value';

type SummaryTableProps = {
    rows: SummaryRow[];
    total: PeriodMetricsDto | null;
    totalIncomplete: boolean;
    /** From buildLocationRows: each place's rows, keyed by parent. */
    locations: Map<string, LocationRow[]>;
};

function ExpandToggle({
    isOpen,
    label,
    onToggle,
}: {
    isOpen: boolean;
    label: string;
    onToggle: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon-xs"
            aria-expanded={isOpen}
            aria-label={label}
            onClick={onToggle}
        >
            <ChevronRight
                className={
                    isOpen
                        ? 'rotate-90 transition-transform'
                        : 'transition-transform'
                }
            />
        </Button>
    );
}

type LocationRowsProps = {
    parentKey: string;
    depth: number;
    locations: Map<string, LocationRow[]>;
    expanded: Set<string>;
    onToggle: (key: string) => void;
};

// Each level indents by INDENT; a guide line runs down from each open
// ancestor's chevron, centred in its 1.5rem button, past the cell's 0.5rem pad.
const INDENT_REM = 1.25;
const guideLeft = (ancestorDepth: number) =>
    `${0.5 + (ancestorDepth - 1) * INDENT_REM + 0.75}rem`;

/**
 * "A › B › C" on one line. The merged ancestors are muted and shorten first,
 * so the deepest place, whose children are listed under the row, stays whole.
 */
function PlaceTrail({
    parts,
    className,
}: {
    parts: string[];
    className?: string;
}) {
    const ancestors = parts.slice(0, -1);
    return (
        <span className={cn('flex min-w-0', className)}>
            {ancestors.length > 0 && (
                <>
                    <span className="text-muted-foreground min-w-0 truncate">
                        {ancestors.join(' › ')}
                    </span>
                    <span
                        className="text-muted-foreground shrink-0 px-1"
                        aria-hidden="true"
                    >
                        ›
                    </span>
                </>
            )}
            <span className="max-w-full shrink-0 truncate">{parts.at(-1)}</span>
        </span>
    );
}

/** A parent's places, each followed by its own places when expanded. */
function LocationRows({
    parentKey,
    depth,
    locations,
    expanded,
    onToggle,
}: LocationRowsProps) {
    const t = useTranslations('Summary');
    return locations.get(parentKey)?.map(row => {
        const names = row.places.map(place => place.name ?? t('unknownSite'));
        const levels = row.places.flatMap(place =>
            place.level ? [place.level] : [],
        );
        const isOpen = expanded.has(row.key);
        return (
            <Fragment key={row.key}>
                <TableRow>
                    <TableCell />
                    <TableCell className="relative">
                        {Array.from({ length: depth - 1 }, (_, index) => (
                            <span
                                key={index}
                                aria-hidden="true"
                                className="bg-border absolute inset-y-0 w-px"
                                style={{ left: guideLeft(index + 1) }}
                            />
                        ))}
                        {/* Zero width, then the column's: labels fit the Program
                            column instead of widening it, so opening a Program
                            never shifts the metric columns. */}
                        <div
                            className="flex w-0 min-w-full items-center gap-1"
                            style={{
                                paddingLeft: `${(depth - 1) * INDENT_REM}rem`,
                            }}
                        >
                            {row.hasChildren ? (
                                <ExpandToggle
                                    isOpen={isOpen}
                                    label={t('toggleLocation', {
                                        location: names.join(', '),
                                    })}
                                    onToggle={() => onToggle(row.key)}
                                />
                            ) : (
                                <span
                                    className="size-6 shrink-0"
                                    aria-hidden="true"
                                />
                            )}
                            <div
                                className="min-w-0 flex-1 overflow-hidden"
                                title={names.join(' › ')}
                            >
                                <PlaceTrail parts={names} />
                                {levels.length > 0 && (
                                    <PlaceTrail
                                        parts={levels}
                                        className="text-muted-foreground text-xs"
                                    />
                                )}
                            </div>
                        </div>
                    </TableCell>
                    {METRICS.map(metric => (
                        <TableCell
                            key={metric.key}
                            className="text-right tabular-nums"
                        >
                            {!metric.programOnly && (
                                <MetricValue
                                    value={metric.value(row.metrics)}
                                    format={metric.format}
                                />
                            )}
                        </TableCell>
                    ))}
                </TableRow>
                {isOpen && (
                    <LocationRows
                        parentKey={row.key}
                        depth={depth + 1}
                        locations={locations}
                        expanded={expanded}
                        onToggle={onToggle}
                    />
                )}
            </Fragment>
        );
    });
}

/** Under the country: the Program name, then its Cycle Label. */
function ProgramNote({
    name,
    cycles,
}: {
    name: string | null;
    cycles: number[];
}) {
    const t = useTranslations('Summary');
    const label = cycleLabel(cycles);
    return (
        <div className="text-muted-foreground pl-4.5 text-xs">
            {name && <p>{name}</p>}
            {label && (
                <p className="whitespace-nowrap">
                    {label.kind === 'list'
                        ? t('cycles', {
                              count: label.count,
                              numbers: label.numbers,
                          })
                        : t('cycleRange', label)}
                </p>
            )}
        </div>
    );
}

function FieldBreakdown({ metrics }: { metrics: PeriodMetricsDto }) {
    const t = useTranslations('Fields');
    return (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {FIELDS.map(field => (
                <div key={field} className="flex gap-2">
                    <dt className="text-muted-foreground">{t(field)}</dt>
                    <dd className="font-medium tabular-nums">
                        <MetricValue
                            value={metrics.fieldCompleteness[field]}
                            format="percent"
                        />
                    </dd>
                </div>
            ))}
        </dl>
    );
}

export default function SummaryTable({
    rows,
    total,
    totalIncomplete,
    locations,
}: SummaryTableProps) {
    const t = useTranslations('Summary');
    const tMetrics = useTranslations('Metrics');
    const [, setFilters] = useDashboardFilters();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const columnCount = METRICS.length + 2;

    function toggle(key: string) {
        setExpanded(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <Table containerClassName="max-h-[40rem] overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow>
                    <TableHead className="w-8">
                        <span className="sr-only">{t('details')}</span>
                    </TableHead>
                    <TableHead>{t('program')}</TableHead>
                    {METRICS.map(metric => (
                        <TableHead
                            key={metric.key}
                            className="text-right whitespace-normal"
                        >
                            {tMetrics(`${metric.key}.title`)}{' '}
                            <MetricInfo metric={metric.key} />
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map(row => {
                    const key = programLocationKey(row.programId);
                    const isOpen = expanded.has(key);
                    return (
                        <Fragment key={row.programId}>
                            <TableRow>
                                <TableCell>
                                    {row.metrics && (
                                        <ExpandToggle
                                            isOpen={isOpen}
                                            label={t('toggleFields', {
                                                program: programTitle(row),
                                            })}
                                            onToggle={() => toggle(key)}
                                        />
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 shrink-0 rounded-full"
                                            style={{ background: row.color }}
                                        />
                                        {row.metrics ? (
                                            <button
                                                type="button"
                                                className="font-medium underline-offset-4 hover:underline"
                                                title={t('openSessions', {
                                                    program: programTitle(row),
                                                })}
                                                onClick={() =>
                                                    setFilters({
                                                        sessions: row.programId,
                                                    })
                                                }
                                            >
                                                {row.country || row.name}
                                            </button>
                                        ) : (
                                            <span className="font-medium">
                                                {row.country || row.name}
                                            </span>
                                        )}
                                        {!row.metrics && (
                                            <Badge variant="destructive">
                                                {t('failed')}
                                            </Badge>
                                        )}
                                        {!row.hasCountryBox && (
                                            <Badge
                                                variant="outline"
                                                title={t('noCountryBoxHint')}
                                            >
                                                {t('noCountryBox')}
                                            </Badge>
                                        )}
                                    </div>
                                    <ProgramNote
                                        name={row.country ? row.name : null}
                                        cycles={row.cycles}
                                    />
                                </TableCell>
                                {METRICS.map(metric => (
                                    <TableCell
                                        key={metric.key}
                                        className="text-right tabular-nums"
                                    >
                                        {row.metrics && (
                                            <MetricValue
                                                value={metric.value(
                                                    row.metrics,
                                                )}
                                                format={metric.format}
                                            />
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                            {isOpen && row.metrics && (
                                <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableCell />
                                    <TableCell colSpan={columnCount - 1}>
                                        <p className="text-muted-foreground mb-1 text-xs font-medium">
                                            {t('fieldCompleteness')}
                                        </p>
                                        <FieldBreakdown metrics={row.metrics} />
                                    </TableCell>
                                </TableRow>
                            )}
                            {isOpen && (
                                <LocationRows
                                    parentKey={key}
                                    depth={1}
                                    locations={locations}
                                    expanded={expanded}
                                    onToggle={toggle}
                                />
                            )}
                        </Fragment>
                    );
                })}
            </TableBody>
            <TableFooter className="[&_td]:bg-card sticky -bottom-px z-10 [&_td]:shadow-[inset_0_1px_0_var(--border)]">
                <TableRow>
                    <TableCell />
                    <TableCell className="font-semibold">
                        {t('total')}
                    </TableCell>
                    {METRICS.map(metric => (
                        <TableCell
                            key={metric.key}
                            className="text-right font-semibold tabular-nums"
                        >
                            {totalIncomplete || !total ? (
                                <span className="text-destructive font-normal">
                                    {t('incomplete')}
                                </span>
                            ) : (
                                <MetricValue
                                    value={metric.value(total)}
                                    format={metric.format}
                                />
                            )}
                        </TableCell>
                    ))}
                </TableRow>
            </TableFooter>
        </Table>
    );
}
