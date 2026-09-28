'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import MonthPicker from '@/components/ui/month-picker';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { FIELDS, METRICS } from '@/features/dashboard/utils/metric-definitions';
import {
    buildSummaryRows,
    summaryToTsv,
} from '@/features/dashboard/utils/summary-rows';
import { Check, Copy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import KpiTiles from './kpi-tiles';
import SessionPanel from './session-panel';
import SummaryTable from './summary-table';

type MonthSummaryProps = { dashboard: Dashboard; month: string };

function monthDate(month: string) {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber - 1, 1));
}

export default function MonthSummary({ dashboard, month }: MonthSummaryProps) {
    const t = useTranslations('Summary');
    const tMetrics = useTranslations('Metrics');
    const tFields = useTranslations('Fields');
    const formatter = useFormatter();
    const [, setFilters] = useDashboardFilters();
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
        'idle',
    );

    const { months, totals } = dashboard.metrics;
    const rows = useMemo(
        () => buildSummaryRows(dashboard, month),
        [dashboard, month],
    );
    const previousMonth = months[months.indexOf(month) - 1] ?? null;
    const incomplete = dashboard.failedProgramIds.length > 0;
    const monthLabel = formatter.dateTime(monthDate(month), {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });

    async function copyTable() {
        const tsv = summaryToTsv(
            rows,
            { metrics: totals[month] ?? null, incomplete },
            {
                header: [
                    `${t('program')} (${monthLabel})`,
                    ...METRICS.map(metric => tMetrics(`${metric.key}.title`)),
                    ...FIELDS.map(field =>
                        t('fieldColumn', { field: tFields(field) }),
                    ),
                ],
                total: t('total'),
                incomplete: t('incomplete'),
            },
        );
        const copied = await navigator.clipboard
            .writeText(tsv)
            .then(() => true)
            .catch(() => false);
        setCopyState(copied ? 'copied' : 'failed');
    }

    return (
        <section
            aria-labelledby="month-summary-heading"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <h2
                        id="month-summary-heading"
                        className="text-lg font-semibold"
                    >
                        {t('heading')}
                    </h2>
                    <MonthPicker
                        label={t('month')}
                        value={month}
                        min={months[0]}
                        max={months[months.length - 1]}
                        onChange={nextMonth => {
                            setCopyState('idle');
                            setFilters({ month: nextMonth });
                        }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span
                        aria-live="polite"
                        className="text-muted-foreground text-sm"
                    >
                        {copyState === 'copied' && t('copied')}
                        {copyState === 'failed' && (
                            <span className="text-destructive">
                                {t('copyFailed')}
                            </span>
                        )}
                    </span>
                    <Button variant="outline" size="sm" onClick={copyTable}>
                        {copyState === 'copied' ? <Check /> : <Copy />}
                        {t('copy')}
                    </Button>
                </div>
            </div>
            <KpiTiles
                current={totals[month] ?? null}
                previous={
                    previousMonth ? (totals[previousMonth] ?? null) : null
                }
                previousMonthLabel={
                    previousMonth
                        ? formatter.dateTime(monthDate(previousMonth), {
                              month: 'short',
                              timeZone: 'UTC',
                          })
                        : null
                }
                incomplete={incomplete}
            />
            <Card className="py-2">
                <CardContent className="px-2">
                    <SummaryTable
                        rows={rows}
                        total={totals[month] ?? null}
                        totalIncomplete={incomplete}
                    />
                </CardContent>
            </Card>
            <SessionPanel
                programNames={
                    new Map(dashboard.programs.map(p => [p.programId, p.name]))
                }
                month={month}
                monthLabel={monthLabel}
            />
        </section>
    );
}
