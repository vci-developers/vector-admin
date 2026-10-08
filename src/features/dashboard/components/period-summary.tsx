'use client';

import type { CoverageDto } from '@/api/coverage/validation/coverage-schema';
import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import { Card, CardContent } from '@/components/ui/card';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import {
    addMonths,
    monthsInRange,
    monthStartDate,
} from '@/features/dashboard/utils/month-key';
import type { MetricKey } from '@/features/dashboard/utils/metric-definitions';
import { buildSummaryGroups } from '@/features/dashboard/utils/summary-rows';
import { Badge } from '@/components/ui/badge';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import CoverageTiles from './coverage-tiles';
import KpiTiles, { SUMMARY_ROW } from './kpi-tiles';
import SessionPanel from './session-panel';
import SummaryTable from './summary-table';

/** A Stakeholder's headline tiles, above the coverage figures. */
const STAKEHOLDER_TILES: MetricKey[] = [
    'uniqueSpecimens',
    'metadataCompleteness',
    'dhis2UploadRate',
];

export default function PeriodSummary({
    dashboard,
    coverage,
    period,
}: {
    dashboard: Dashboard;
    coverage: CoverageDto | null;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Summary');
    const formatter = useFormatter();

    const { total, previousTotal } = dashboard.metrics;
    const isDeveloper = dashboard.viewer === 'developer';
    const groups = useMemo(() => buildSummaryGroups(dashboard), [dashboard]);
    const incomplete = dashboard.failedProgramIds.length > 0;
    const length = monthsInRange(period.from, period.to).length;
    // A single month compares with the month before ("Oct"); longer periods
    // with the same-length span before them. A period still in progress is
    // not compared: its counts are still rising.
    const previousLabel =
        !previousTotal || period.inProgress
            ? null
            : length === 1
              ? formatter.dateTime(monthStartDate(addMonths(period.from, -1)), {
                    month: 'short',
                    timeZone: 'UTC',
                })
              : t('previousMonths', { count: length });

    return (
        // A Stakeholder's heading is in the toolbar (DashboardView).
        <section
            aria-labelledby="summary-heading"
            className="flex flex-col gap-4"
        >
            {isDeveloper && (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2
                            id="summary-heading"
                            className="text-lg font-semibold"
                        >
                            {t('heading', { period: period.label })}
                        </h2>
                        {period.inProgress && (
                            <Badge variant="outline">{t('inProgress')}</Badge>
                        )}
                    </div>
                    {period.inProgress && (
                        <p className="text-muted-foreground -mt-2 text-sm">
                            {t('inProgressHint', {
                                month: formatter.dateTime(
                                    monthStartDate(period.to),
                                    { month: 'long', timeZone: 'UTC' },
                                ),
                            })}
                        </p>
                    )}
                </>
            )}
            {isDeveloper ? (
                <>
                    {total && (
                        <KpiTiles
                            current={total}
                            trend={{
                                previous: previousTotal,
                                label: previousLabel,
                            }}
                            incomplete={incomplete}
                        />
                    )}
                    <CoverageTiles
                        coverage={coverage}
                        userCoverage={dashboard.userCoverage}
                        programs={dashboard.programs}
                    />
                </>
            ) : (
                <div className={SUMMARY_ROW}>
                    {total && (
                        // No trend line: Stakeholders get the period's figures alone.
                        <KpiTiles
                            current={total}
                            incomplete={incomplete}
                            keys={STAKEHOLDER_TILES}
                            asCells
                        />
                    )}
                    <CoverageTiles
                        coverage={coverage}
                        userCoverage={dashboard.userCoverage}
                        programs={dashboard.programs}
                        asCells
                    />
                </div>
            )}
            {isDeveloper && total && (
                <>
                    <Card className="py-2">
                        <CardContent className="px-2">
                            <SummaryTable
                                groups={groups}
                                total={total}
                                totalIncomplete={incomplete}
                            />
                        </CardContent>
                    </Card>
                    <SessionPanel
                        programs={
                            new Map(
                                dashboard.programs.map(p => [p.programId, p]),
                            )
                        }
                        period={period}
                    />
                </>
            )}
        </section>
    );
}
