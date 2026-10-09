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
    /**
     * Each Program's figures, listed under the total when there are several;
     * Programs with no figure for a tile are left off it.
     */
    breakdown?: ProgramFigures[];
};

export type ProgramFigures = {
    programId: number;
    name: string;
    /** Short form for the line, e.g. "UG"; the name is its hover. */
    code: string;
    metrics: PeriodMetricsDto;
};

/** Under a total: one line per Program, names and figures lined up. */
function ProgramBreakdown({
    breakdown,
    metric,
}: {
    breakdown: ProgramFigures[];
    metric: (typeof METRICS)[number];
}) {
    const lines = breakdown.flatMap(row => {
        const value = metric.value(row.metrics);
        return value === null ? [] : [{ ...row, value }];
    });
    if (lines.length === 0) return null;
    return (
        <ul className="grid grid-cols-[minmax(0,1fr)_auto] content-start gap-x-2 self-start text-xs tabular-nums">
            {lines.map(line => (
                <li key={line.programId} className="contents">
                    <span
                        className="text-muted-foreground truncate"
                        title={line.name}
                    >
                        {line.code}
                    </span>
                    <span className="text-right font-medium">
                        <MetricValue
                            value={line.value}
                            format={metric.format}
                        />
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * A Stakeholder's eight summary tiles (three headline, four coverage, then
 * the deployed models) on one row on wide screens, so the page above the map
 * stays short. The headline tiles hold one short figure each, so they give up
 * width to the models tile's lines.
 */
export const SUMMARY_ROW =
    'grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[repeat(3,minmax(0,0.7fr))_repeat(4,minmax(0,1fr))_minmax(0,1.25fr)]';

/**
 * A tile in SUMMARY_ROW. Every tile shares the row's three lines (title,
 * figure, Program lines), so figures line up whatever sits under them: put
 * the figure in row 2 (`self-end`) and any per-Program lines in row 3.
 */
export const SUMMARY_CELL =
    'row-span-3 grid grid-rows-subgrid gap-x-0 gap-y-1 px-4 py-3';

export default function KpiTiles({
    current,
    trend,
    incomplete,
    keys,
    asCells = false,
    breakdown,
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
                        className={asCells ? SUMMARY_CELL : 'gap-1 px-4 py-3'}
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
                        <p
                            className={cn(
                                'text-2xl font-semibold tabular-nums',
                                asCells && 'self-end',
                            )}
                        >
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
                        {/* Each Program's figure under the total. */}
                        {breakdown && breakdown.length > 1 && (
                            <ProgramBreakdown
                                breakdown={breakdown}
                                metric={metric}
                            />
                        )}
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
