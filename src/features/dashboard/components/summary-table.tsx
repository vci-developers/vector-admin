'use client';

import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { cycleLabel } from '@/features/dashboard/utils/cycle-label';
import { programTitle } from '@/features/dashboard/utils/program-title';
import {
    SHEET_COLUMNS,
    summaryToTsv,
    type SheetColumn,
    type SummaryGroup,
    type SummaryRow,
} from '@/features/dashboard/utils/summary-rows';
import { cn } from '@/utils/cn';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import MetricInfo, { InfoTip } from './metric-info';
import MetricValue from './metric-value';

const METRIC_COLUMNS = SHEET_COLUMNS.filter(c => c.kind === 'metric');
const FIELD_COLUMNS = SHEET_COLUMNS.filter(c => c.kind === 'field');
const TIMING_COLUMNS = SHEET_COLUMNS.filter(c => c.kind === 'timing');
// Checkbox and name stay in view while the numbers scroll sideways; solid
// colours so the numbers don't show through, matching the row's hover and
// selected shades.
const PINNED =
    'bg-card sticky left-0 z-[1] shadow-[inset_-1px_0_0_var(--border)] group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] group-data-[state=selected]/row:bg-muted';

// A faint rule and extra room before the field and timing groups.
const DIVIDER = 'border-border/60 border-l pl-4';
const GROUP_STARTS: SheetColumn[] = [FIELD_COLUMNS[0], TIMING_COLUMNS[0]];

// Checkbox and name, the sheet's columns, copy button.
const COLUMN_COUNT = SHEET_COLUMNS.length + 2;
const GRAND_TOTAL_KEY = 'total';

function ColumnHeader({ column }: { column: SheetColumn }) {
    const tMetrics = useTranslations('Metrics');
    const tFields = useTranslations('Fields');
    const t = useTranslations('Summary');
    switch (column.kind) {
        case 'metric':
            return (
                <>
                    {tMetrics(`${column.key}.title`)}
                    {'\u00a0'}
                    <MetricInfo metric={column.key} />
                </>
            );
        case 'field':
            return tFields(column.key);
        case 'timing':
            return (
                <>
                    {t(`timing.${column.key}`)}
                    {'\u00a0'}
                    <InfoTip
                        label={t('timingHowDerived', {
                            stat: t(`timing.${column.key}`),
                        })}
                    >
                        {t(`timingInfo.${column.key}`)}
                    </InfoTip>
                </>
            );
    }
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
        <span className="text-muted-foreground text-xs font-normal">
            {name}
            {name && label && ' · '}
            {label &&
                (label.kind === 'list'
                    ? t('cycles', {
                          count: label.count,
                          numbers: label.numbers,
                      })
                    : t('cycleRange', label))}
        </span>
    );
}

type RowProps = {
    label: string;
    metrics: PeriodMetricsDto | null;
    incomplete?: boolean;
    emphasis?: boolean;
    /** Position in Copy selected, from 1; null when not ticked. */
    pick: number | null;
    isCopied: boolean;
    onSelect: (selected: boolean) => void;
    onCopy: () => void;
};

function SheetRow({
    label,
    metrics,
    incomplete = false,
    emphasis = false,
    pick,
    isCopied,
    onSelect,
    onCopy,
}: RowProps) {
    const t = useTranslations('Summary');
    const canCopy = metrics !== null && !incomplete;
    return (
        // The checkbox stays the keyboard control; clicking anywhere else on
        // the row is a shortcut for it.
        <TableRow
            data-state={pick !== null ? 'selected' : undefined}
            className={cn('group/row', canCopy && 'cursor-pointer')}
            onClick={() => canCopy && onSelect(pick === null)}
        >
            <TableCell className={cn(PINNED, emphasis && 'font-semibold')}>
                <div className="flex items-center gap-1.5 pr-2">
                    <Checkbox
                        checked={pick !== null}
                        disabled={!canCopy}
                        onCheckedChange={checked => onSelect(checked === true)}
                        onClick={event => event.stopPropagation()}
                        aria-label={t('selectRow', { row: label })}
                    />
                    <span className="text-muted-foreground w-3 text-xs font-normal tabular-nums">
                        {pick}
                    </span>
                    {label}
                </div>
            </TableCell>
            {SHEET_COLUMNS.map(column => (
                <TableCell
                    key={`${column.kind}:${column.key}`}
                    className={cn(
                        'px-3 text-center tabular-nums',
                        emphasis && 'font-semibold',
                        GROUP_STARTS.includes(column) && DIVIDER,
                    )}
                >
                    {incomplete ? (
                        <span className="text-destructive font-normal">
                            {t('incomplete')}
                        </span>
                    ) : (
                        metrics && (
                            <MetricValue
                                value={column.value(metrics)}
                                format={column.format}
                            />
                        )
                    )}
                </TableCell>
            ))}
            <TableCell>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!canCopy}
                    onClick={event => {
                        event.stopPropagation();
                        onCopy();
                    }}
                    aria-label={t('copyRow', { row: label })}
                >
                    {isCopied ? <Check /> : <Copy />}
                </Button>
            </TableCell>
        </TableRow>
    );
}

export default function SummaryTable({
    groups,
    total,
    totalIncomplete,
}: {
    groups: SummaryGroup[];
    total: PeriodMetricsDto | null;
    totalIncomplete: boolean;
}) {
    const t = useTranslations('Summary');
    const [, setFilters] = useDashboardFilters();
    // Row keys in the order ticked, which is the order Copy selected pastes.
    const [selected, setSelected] = useState<string[]>([]);
    const [copied, setCopied] = useState<string | 'failed' | null>(null);

    const showGrandTotal = groups.length > 1;
    const rowsInOrder: SummaryRow[] = [
        ...groups.flatMap(group => [...group.areas, group.total]),
        ...(showGrandTotal && !totalIncomplete
            ? [{ key: GRAND_TOTAL_KEY, name: null, metrics: total }]
            : []),
    ];

    async function copy(key: string, rows: SummaryRow[]) {
        const ok = await navigator.clipboard
            .writeText(summaryToTsv(rows.map(row => row.metrics)))
            .then(() => true)
            .catch(() => false);
        setCopied(ok ? key : 'failed');
    }

    function rowProps(row: SummaryRow) {
        return {
            pick: selected.includes(row.key)
                ? selected.indexOf(row.key) + 1
                : null,
            isCopied: copied === row.key,
            onSelect: (isSelected: boolean) =>
                setSelected(current =>
                    isSelected
                        ? [...current, row.key]
                        : current.filter(key => key !== row.key),
                ),
            onCopy: () => copy(row.key, [row]),
        };
    }

    const areaLabel = ({ level }: SummaryGroup, name: string | null) =>
        name ??
        (level
            ? t('noArea', { level: level.toLowerCase() })
            : t('noAreaNoLevel'));

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                <p className="text-muted-foreground text-xs">
                    {t('timingNote')}
                </p>
                <div className="flex items-center gap-2">
                    <span aria-live="polite" className="text-sm">
                        {copied === 'failed' ? (
                            <span className="text-destructive">
                                {t('copyFailed')}
                            </span>
                        ) : (
                            copied !== null && (
                                <span className="text-muted-foreground">
                                    {t('copied')}
                                </span>
                            )
                        )}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={selected.length === 0}
                        onClick={() => setSelected([])}
                    >
                        {t('deselectAll')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={selected.length === 0}
                        onClick={() =>
                            copy(
                                'selected',
                                selected.flatMap(key =>
                                    rowsInOrder.filter(row => row.key === key),
                                ),
                            )
                        }
                    >
                        {copied === 'selected' ? <Check /> : <Copy />}
                        {t('copySelected', { count: selected.length })}
                    </Button>
                </div>
            </div>
            <Table containerClassName="max-h-[40rem] overflow-auto">
                <TableHeader className="bg-card sticky top-0 z-10 [&_th]:h-auto [&_th]:py-2 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                    <TableRow>
                        <TableHead
                            rowSpan={2}
                            className="bg-card sticky left-0 z-[1] align-bottom shadow-[inset_-1px_-1px_0_var(--border)]!"
                        >
                            <span className="pl-10">{t('area')}</span>
                        </TableHead>
                        {METRIC_COLUMNS.map(column => (
                            <TableHead
                                key={column.key}
                                rowSpan={2}
                                className="px-3 text-center align-bottom"
                            >
                                <ColumnHeader column={column} />
                            </TableHead>
                        ))}
                        <TableHead
                            colSpan={FIELD_COLUMNS.length}
                            className={cn(DIVIDER, 'text-center')}
                        >
                            {t('fieldsGroup')}
                        </TableHead>
                        <TableHead
                            colSpan={TIMING_COLUMNS.length}
                            className={cn(DIVIDER, 'text-center')}
                        >
                            {t('timingGroup')}
                        </TableHead>
                        <TableHead rowSpan={2} className="w-10">
                            <span className="sr-only">{t('copy')}</span>
                        </TableHead>
                    </TableRow>
                    <TableRow>
                        {[...FIELD_COLUMNS, ...TIMING_COLUMNS].map(column => (
                            <TableHead
                                key={`${column.kind}:${column.key}`}
                                className={cn(
                                    'px-3 text-center align-bottom',
                                    GROUP_STARTS.includes(column) && DIVIDER,
                                )}
                            >
                                <ColumnHeader column={column} />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groups.map(group => (
                        <Fragment key={group.programId}>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                <TableCell
                                    colSpan={COLUMN_COUNT}
                                    className="font-medium"
                                >
                                    <div className="sticky left-2 flex w-fit items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 shrink-0 rounded-full"
                                            style={{ background: group.color }}
                                        />
                                        {group.total.metrics ? (
                                            <button
                                                type="button"
                                                className="underline-offset-4 hover:underline"
                                                title={t('openSessions', {
                                                    program:
                                                        programTitle(group),
                                                })}
                                                onClick={() =>
                                                    setFilters({
                                                        sessions:
                                                            group.programId,
                                                    })
                                                }
                                            >
                                                {group.country || group.name}
                                            </button>
                                        ) : (
                                            <>
                                                {group.country || group.name}
                                                <Badge variant="destructive">
                                                    {t('failed')}
                                                </Badge>
                                            </>
                                        )}
                                        <ProgramNote
                                            name={
                                                group.country
                                                    ? group.name
                                                    : null
                                            }
                                            cycles={group.cycles}
                                        />
                                    </div>
                                </TableCell>
                            </TableRow>
                            {group.areas.map(row => (
                                <SheetRow
                                    key={row.key}
                                    label={areaLabel(group, row.name)}
                                    metrics={row.metrics}
                                    {...rowProps(row)}
                                />
                            ))}
                            <SheetRow
                                label={t('programTotal')}
                                metrics={group.total.metrics}
                                emphasis
                                {...rowProps(group.total)}
                            />
                        </Fragment>
                    ))}
                </TableBody>
                {showGrandTotal && (
                    <TableFooter className="[&_td]:bg-card sticky -bottom-px z-10 [&_td]:shadow-[inset_0_1px_0_var(--border)]">
                        <SheetRow
                            label={t('total')}
                            metrics={total}
                            incomplete={totalIncomplete}
                            emphasis
                            {...rowProps({
                                key: GRAND_TOTAL_KEY,
                                name: null,
                                metrics: total,
                            })}
                        />
                    </TableFooter>
                )}
            </Table>
        </div>
    );
}
