'use client';

import type { PeriodMetricsDto } from '@/api/dashboard/validation/dashboard-schema';
import { Card } from '@/components/ui/card';
import {
    METRICS,
    ratioCounts,
    type MetricKey,
} from '@/features/dashboard/utils/metric-definitions';
import { cn } from '@/utils/cn';
import {
    Bug,
    ClipboardCheck,
    CloudUpload,
    Gauge,
    LogIn,
    ScanLine,
    Smartphone,
    Users,
    type LucideIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import MetricInfo from './metric-info';
import tones from './kpi-tiles.module.css';
import MetricValue from './metric-value';

type KpiTilesProps = {
    current: PeriodMetricsDto | null;
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
    'grid grid-cols-2 gap-(--d-grid) md:grid-cols-4 xl:grid-cols-[repeat(3,minmax(0,0.7fr))_repeat(4,minmax(0,1fr))_minmax(0,1.25fr)]';

/**
 * A tile in SUMMARY_ROW. Every tile shares the row's three lines (title,
 * figure, Program lines), so figures line up whatever sits under them: put
 * the figure in row 2 (`self-end`) and any per-Program lines in row 3.
 */
// The Stakeholder headlines' icon chips; Scans and Specimens use theirs.
const ICONS: Record<MetricKey, LucideIcon> = {
    activeDevices: Smartphone,
    images: ScanLine,
    uniqueSpecimens: Bug,
    imagesPerActiveDevice: Gauge,
    uniqueUsers: Users,
    logins: LogIn,
    metadataCompleteness: ClipboardCheck,
    dhis2UploadRate: CloudUpload,
};

function MetricIcon({
    metric,
    className,
}: {
    metric: MetricKey;
    className: string;
}) {
    const Icon = ICONS[metric];
    return <Icon className={className} aria-hidden="true" />;
}

export const SUMMARY_CELL =
    'row-span-3 grid grid-rows-subgrid gap-x-0 gap-y-1 px-(--d-pad-x)';

export default function KpiTiles({
    current,
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
                asCells
                    ? 'contents'
                    : cn(
                          'grid grid-cols-2 gap-(--d-grid) md:grid-cols-4',
                          tones.cascade,
                      )
            }
        >
            {shown.map(metric => {
                const value = current ? metric.value(current) : null;
                const counts =
                    current && metric.format === 'percent' && metric.calculation
                        ? ratioCounts(metric.calculation(current))
                        : null;

                return (
                    <Card
                        key={metric.key}
                        className={
                            asCells ? SUMMARY_CELL : 'gap-1 px-(--d-pad-x)'
                        }
                    >
                        <div className="flex items-start justify-between gap-2">
                            <p
                                className={cn(
                                    asCells
                                        ? 'text-muted-foreground text-xs font-medium text-pretty'
                                        : 'text-sm font-semibold tracking-[-0.01em] text-pretty text-(color:--ink)',
                                )}
                            >
                                {/* The no-break space keeps the icon on the
                                    title's last word when it wraps. */}
                                {t(`${metric.key}.title`)}
                                {'\u00a0'}
                                <span className="inline-flex align-[-2px]">
                                    <MetricInfo
                                        metric={metric.key}
                                        metrics={
                                            current && !incomplete
                                                ? current
                                                : undefined
                                        }
                                    />
                                </span>
                            </p>
                            {!asCells && (
                                <span className={tones.chip}>
                                    <MetricIcon
                                        metric={metric.key}
                                        className="size-4"
                                    />
                                </span>
                            )}
                        </div>
                        <p
                            className={cn(
                                'font-semibold tracking-[-0.045em] text-(color:--ink) tabular-nums',
                                asCells ? 'self-end text-2xl' : 'text-3xl',
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
                        {!asCells && !incomplete && counts && (
                            <p className="text-muted-foreground text-xs tabular-nums">
                                {tKpi('ofRecords', {
                                    numerator: formatter.number(
                                        counts.numerator,
                                    ),
                                    denominator: formatter.number(
                                        counts.denominator,
                                    ),
                                })}
                            </p>
                        )}
                        {/* Each Program's figure under the total. */}
                        {breakdown && breakdown.length > 1 && (
                            <ProgramBreakdown
                                breakdown={breakdown}
                                metric={metric}
                            />
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
