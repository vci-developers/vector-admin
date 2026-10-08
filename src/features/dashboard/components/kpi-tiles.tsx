'use client';

import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import {
    METRICS,
    type MetricKey,
} from '@/features/dashboard/utils/metric-definitions';
import { cn } from '@/utils/cn';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import MetricInfo from './metric-info';
import MetricValue from './metric-value';

type KpiTilesProps = {
    current: PeriodMetricsDto | null;
    /** The change on the previous period under each figure; none when omitted. */
    trend?: {
        previous: PeriodMetricsDto | null;
        /** e.g. "Oct" or "previous 3 months"; null when there is no previous period. */
        label: string | null;
    };
    incomplete: boolean;
    /** The tiles to show, in order; every metric when omitted. */
    keys?: MetricKey[];
    /** Render the tiles as cells of the parent's grid (see SUMMARY_ROW). */
    asCells?: boolean;
};

/**
 * A Stakeholder's seven summary tiles (three headline, four coverage) on one
 * row on wide screens, so the page above the map stays short.
 */
export const SUMMARY_ROW =
    'grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7';

export default function KpiTiles({
    current,
    trend,
    incomplete,
    keys,
    asCells = false,
}: KpiTilesProps) {
    const t = useTranslations('Metrics');
    const tKpi = useTranslations('Kpi');
    const formatter = useFormatter();
    const shown = keys
        ? keys.flatMap(key => METRICS.filter(m => m.key === key))
        : METRICS;

    return (
        <div
            className={
                asCells ? 'contents' : 'grid grid-cols-2 gap-3 md:grid-cols-4'
            }
        >
            {shown.map(metric => {
                const value = current ? metric.value(current) : null;
                const before = trend?.previous
                    ? metric.value(trend.previous)
                    : null;
                const previousLabel = trend?.label;
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
                    <Card
                        key={metric.key}
                        className={cn(
                            'gap-1 px-4 py-3',
                            // In the shared row the figures sit on one line at
                            // the foot of every tile, whatever is above them.
                            asCells && 'justify-between gap-3',
                        )}
                    >
                        <p
                            className={cn(
                                'text-muted-foreground text-xs font-medium',
                                // The icon follows the title's last word.
                                asCells
                                    ? 'text-pretty'
                                    : 'flex items-center gap-1',
                            )}
                        >
                            {t(`${metric.key}.title`)}{' '}
                            <MetricInfo
                                metric={metric.key}
                                metrics={
                                    current && !incomplete ? current : undefined
                                }
                            />
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
                        {trend && (
                            <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                {delta !== null && previousLabel ? (
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
                                                          signDisplay:
                                                              'exceptZero',
                                                      },
                                                  ),
                                                  month: previousLabel,
                                              })
                                            : tKpi('delta', {
                                                  delta: formatter.number(
                                                      delta,
                                                      {
                                                          maximumFractionDigits:
                                                              metric.format ===
                                                              'decimal'
                                                                  ? 1
                                                                  : 0,
                                                          signDisplay:
                                                              'exceptZero',
                                                      },
                                                  ),
                                                  month: previousLabel,
                                              })}
                                    </>
                                ) : (
                                    <span aria-hidden="true">&nbsp;</span>
                                )}
                            </p>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
