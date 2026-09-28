'use client';

import type { MonthMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import { METRICS } from '@/features/dashboard/utils/metric-definitions';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import MetricValue from './metric-value';

type KpiTilesProps = {
    current: MonthMetricsDto | null;
    previous: MonthMetricsDto | null;
    previousMonthLabel: string | null;
    incomplete: boolean;
};

export default function KpiTiles({
    current,
    previous,
    previousMonthLabel,
    incomplete,
}: KpiTilesProps) {
    const t = useTranslations('Metrics');
    const tKpi = useTranslations('Kpi');
    const formatter = useFormatter();

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {METRICS.map(metric => {
                const value = current ? metric.value(current) : null;
                const before = previous ? metric.value(previous) : null;
                const delta =
                    !incomplete && value !== null && before !== null
                        ? value - before
                        : null;
                const DeltaIcon =
                    delta === null || delta === 0
                        ? Minus
                        : delta > 0
                          ? ArrowUp
                          : ArrowDown;

                return (
                    <Card key={metric.key} className="gap-1 px-4 py-3">
                        <p
                            className="text-muted-foreground text-xs font-medium"
                            title={t(`${metric.key}.description`)}
                        >
                            {t(`${metric.key}.title`)}
                        </p>
                        <p className="text-2xl font-semibold tabular-nums">
                            {incomplete ? (
                                <span className="text-destructive text-base font-medium">
                                    {tKpi('incomplete')}
                                </span>
                            ) : (
                                <MetricValue
                                    value={value}
                                    format={metric.format}
                                />
                            )}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            {delta !== null && previousMonthLabel ? (
                                <>
                                    <DeltaIcon
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                    {metric.format === 'percent'
                                        ? tKpi('deltaPoints', {
                                              delta: formatter.number(
                                                  delta * 100,
                                                  {
                                                      maximumFractionDigits: 0,
                                                      signDisplay: 'exceptZero',
                                                  },
                                              ),
                                              month: previousMonthLabel,
                                          })
                                        : tKpi('delta', {
                                              delta: formatter.number(delta, {
                                                  maximumFractionDigits:
                                                      metric.format ===
                                                      'decimal'
                                                          ? 1
                                                          : 0,
                                                  signDisplay: 'exceptZero',
                                              }),
                                              month: previousMonthLabel,
                                          })}
                                </>
                            ) : (
                                <span aria-hidden="true">&nbsp;</span>
                            )}
                        </p>
                    </Card>
                );
            })}
        </div>
    );
}
