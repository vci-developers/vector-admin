'use client';

import type { MonthMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
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
import type { SummaryRow } from '@/features/dashboard/utils/summary-rows';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import MetricValue from './metric-value';

type SummaryTableProps = {
    rows: SummaryRow[];
    total: MonthMetricsDto | null;
    totalIncomplete: boolean;
};

function FieldBreakdown({ metrics }: { metrics: MonthMetricsDto }) {
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
}: SummaryTableProps) {
    const t = useTranslations('Summary');
    const tMetrics = useTranslations('Metrics');
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const columnCount = METRICS.length + 2;

    function toggle(programId: number) {
        setExpanded(current => {
            const next = new Set(current);
            if (next.has(programId)) next.delete(programId);
            else next.add(programId);
            return next;
        });
    }

    return (
        <Table>
            <TableHeader>
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
                            {tMetrics(`${metric.key}.title`)}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map(row => {
                    const isOpen = expanded.has(row.programId);
                    return (
                        <Fragment key={row.programId}>
                            <TableRow>
                                <TableCell>
                                    {row.metrics && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-expanded={isOpen}
                                            aria-label={t('toggleFields', {
                                                program: row.name,
                                            })}
                                            onClick={() =>
                                                toggle(row.programId)
                                            }
                                        >
                                            <ChevronRight
                                                className={
                                                    isOpen
                                                        ? 'rotate-90 transition-transform'
                                                        : 'transition-transform'
                                                }
                                            />
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 shrink-0 rounded-full"
                                            style={{ background: row.color }}
                                        />
                                        <span className="font-medium">
                                            {row.name}
                                        </span>
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
                                    {row.cycles.length > 0 && (
                                        <p className="text-muted-foreground pl-4.5 text-xs">
                                            {t('cycles', {
                                                count: row.cycles.length,
                                                numbers: row.cycles.join(', '),
                                            })}
                                        </p>
                                    )}
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
                        </Fragment>
                    );
                })}
            </TableBody>
            <TableFooter>
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
