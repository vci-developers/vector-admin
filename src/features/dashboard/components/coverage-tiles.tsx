'use client';

import type { CoverageDto } from '@/api/coverage/validation/coverage-schema';
import type { UserCoverageDto } from '@/api/dashboard/validation/dashboard-schema';
import type { Program } from '@/api/program/validation/program-schema';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { cn } from '@/utils/cn';
import { useFormatter, useTranslations } from 'next-intl';
import { InfoTip } from './metric-info';
import MetricValue from './metric-value';

const PLACE_METRICS = ['geographicCoverage', 'penetration'] as const;
const USER_METRICS = [
    'instantaneousUserCoverage',
    'programUserCoverage',
] as const satisfies (keyof UserCoverageDto)[];
const COVERAGE_METRICS = [...PLACE_METRICS, ...USER_METRICS];

type CoverageMetric = (typeof COVERAGE_METRICS)[number];
type Ratio = NonNullable<UserCoverageDto['programUserCoverage']>;
type Line = { programId: number; ratio: Ratio };

const isUserMetric = (
    metric: CoverageMetric,
): metric is (typeof USER_METRICS)[number] =>
    (USER_METRICS as readonly string[]).includes(metric);

const TILE_GRID = 'grid grid-cols-2 gap-3 md:grid-cols-4';

function ProgramLines({
    lines,
    names,
}: {
    lines: Line[];
    names: Map<number, string>;
}) {
    const working = (ratio: Ratio) =>
        `${ratio.numerator} / ${ratio.denominator}`;
    // Shaped like the headline tiles: the percentage large, its working
    // small beside it, so the tile is no taller than theirs.
    if (lines.length <= 1) {
        const ratio = lines[0]?.ratio;
        return (
            <p className="flex items-baseline gap-2 tabular-nums">
                <span className="text-2xl font-semibold">
                    <MetricValue
                        value={ratio?.value ?? null}
                        format="percent"
                    />
                </span>
                {ratio && (
                    <span className="text-muted-foreground text-xs">
                        {working(ratio)}
                    </span>
                )}
            </p>
        );
    }
    // Several Programs: a small table, so names, percentages and workings
    // each line up and names keep the room the figures don't need.
    return (
        <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-2 gap-y-0.5 text-xs tabular-nums">
            {lines.map(({ programId, ratio }) => (
                <li key={programId} className="contents">
                    <span
                        className="text-muted-foreground truncate"
                        title={names.get(programId)}
                    >
                        {names.get(programId) ?? programId}
                    </span>
                    <span className="text-right text-sm font-semibold">
                        <MetricValue value={ratio.value} format="percent" />
                    </span>
                    <span className="text-muted-foreground text-right">
                        {working(ratio)}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/**
 * The four coverage metrics: places from the team's workbook, users from
 * VectorCam over the workbook's figures. One figure for one Program, else one
 * line per Program.
 */
export default function CoverageTiles({
    coverage,
    userCoverage,
    programs,
    asCells = false,
}: {
    /** null while it loads. */
    coverage: CoverageDto | null;
    /** Comes with the Sessions; null while they load. */
    userCoverage: UserCoverageDto[] | null;
    programs: Program[];
    /** Render the tiles as cells of the parent's grid (see SUMMARY_ROW). */
    asCells?: boolean;
}) {
    const t = useTranslations('Coverage');
    const formatter = useFormatter();
    const names = new Map(
        programs.map(p => [p.programId, p.country || p.name]),
    );

    if (!coverage) {
        return (
            <div className={asCells ? 'contents' : TILE_GRID}>
                {COVERAGE_METRICS.map(metric => (
                    <Card key={metric} className="gap-2 px-4 py-3">
                        <Skeleton height="xs" width="sm" />
                        <Skeleton height="lg" width="md" />
                    </Card>
                ))}
            </div>
        );
    }
    if (!coverage.ok) {
        return (
            <p role="alert" className="text-destructive col-span-full text-sm">
                {t('unavailable', { reason: coverage.error })}
            </p>
        );
    }
    const { data } = coverage;
    const linesOf = (metric: CoverageMetric): Line[] | null => {
        const rows = isUserMetric(metric) ? userCoverage : data.programs;
        if (!rows) return null;
        return rows.flatMap(row => {
            const ratio = (
                row as Partial<Record<CoverageMetric, Ratio | null>>
            )[metric];
            return ratio ? [{ programId: row.programId, ratio }] : [];
        });
    };
    const userMonth = userCoverage?.[0]?.month;
    const monthLabel = userMonth
        ? formatter.dateTime(monthStartDate(userMonth), {
              month: 'short',
              timeZone: 'UTC',
          })
        : undefined;

    return (
        <div className={asCells ? 'contents' : 'flex flex-col gap-2'}>
            {data.source === 'saved' && data.savedAt !== null && (
                // As grid cells: a full-width line before every tile.
                <p className="text-muted-foreground order-first col-span-full flex items-center gap-1 text-xs">
                    {t('savedCopy', {
                        date: formatter.dateTime(data.savedAt, {
                            dateStyle: 'medium',
                        }),
                    })}
                    {data.liveProblem && (
                        <InfoTip label={t('whySavedCopy')}>
                            {data.liveProblem}
                        </InfoTip>
                    )}
                </p>
            )}
            <div className={asCells ? 'contents' : TILE_GRID}>
                {COVERAGE_METRICS.map(metric => {
                    const lines = linesOf(metric);
                    return (
                        <Card
                            key={metric}
                            className={cn(
                                'gap-1 px-4 py-3',
                                // As in the headline tiles: figures at the foot.
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
                                {t(`${metric}.title`)}
                                {/* User figures are for one month: named once. */}
                                {isUserMetric(metric) && monthLabel && (
                                    <span className="text-muted-foreground/70 font-normal">
                                        {' · '}
                                        {monthLabel}
                                    </span>
                                )}{' '}
                                <InfoTip
                                    label={t('howDerived', {
                                        metric: t(`${metric}.title`),
                                    })}
                                >
                                    <p>{t(`${metric}.description`)}</p>
                                </InfoTip>
                            </p>
                            {lines ? (
                                <ProgramLines lines={lines} names={names} />
                            ) : (
                                <Skeleton height="lg" width="md" />
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
