'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { FIELDS, METRICS } from '@/features/dashboard/utils/metric-definitions';
import {
    addMonths,
    monthsInRange,
    monthStartDate,
} from '@/features/dashboard/utils/month-key';
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

export default function PeriodSummary({
    dashboard,
    period,
}: {
    dashboard: Dashboard;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Summary');
    const tMetrics = useTranslations('Metrics');
    const tFields = useTranslations('Fields');
    const formatter = useFormatter();
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
        'idle',
    );

    const { total, previousTotal } = dashboard.metrics;
    const rows = useMemo(() => buildSummaryRows(dashboard), [dashboard]);
    const incomplete = dashboard.failedProgramIds.length > 0;
    const length = monthsInRange(period.from, period.to).length;
    // A single month compares with the month before ("Oct"); longer periods
    // with the same-length span before them.
    const previousLabel = !previousTotal
        ? null
        : length === 1
          ? formatter.dateTime(monthStartDate(addMonths(period.from, -1)), {
                month: 'short',
                timeZone: 'UTC',
            })
          : t('previousMonths', { count: length });

    async function copyTable() {
        const tsv = summaryToTsv(
            rows,
            { metrics: total, incomplete },
            {
                header: [
                    `${t('program')} (${period.label})`,
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
            aria-labelledby="summary-heading"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="summary-heading" className="text-lg font-semibold">
                    {t('heading', { period: period.label })}
                </h2>
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
                current={total}
                previous={previousTotal}
                previousLabel={previousLabel}
                incomplete={incomplete}
            />
            <Card className="py-2">
                <CardContent className="px-2">
                    <SummaryTable
                        rows={rows}
                        total={total}
                        totalIncomplete={incomplete}
                    />
                </CardContent>
            </Card>
            <SessionPanel
                programNames={
                    new Map(dashboard.programs.map(p => [p.programId, p.name]))
                }
                period={period}
            />
        </section>
    );
}
