import type { Program } from '@/api/program/validation/program-schema';
import type {
    ProgressLocationCoverage,
    ProgressSentinelSites,
} from '@/api/progress/validation/progress-schema';
import {
    formatSentinelSites,
    groupProgressLocationsByUnit,
    progressLocationUnitLabel,
    totalProgressLocations,
    totalSentinelSites,
} from '@/features/dashboard/utils/format-progress-locations';
import { cn } from '@/utils/cn';
import { MapPin } from 'lucide-react';
import { useFormatter } from 'next-intl';
import HeadlineExpandButton from './headline-expand-button';
import styles from './progress-view.module.css';

export default function ProgressCoverageHeadline({
    coverage,
    sentinelSites,
    programs,
    expanded,
    onToggle,
}: {
    coverage: readonly ProgressLocationCoverage[];
    sentinelSites: readonly ProgressSentinelSites[];
    programs: readonly Program[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    const units = groupProgressLocationsByUnit(coverage);
    const sharedUnit = units.length === 1 ? units[0] : null;
    // A location uses its program's reporting level, retained in the breakdown.
    // Never present a partial location sum as complete coverage.
    const total = totalProgressLocations(coverage);
    const totalUnit = sharedUnit
        ? progressLocationUnitLabel(sharedUnit.unit, total)
        : total === 1
          ? 'reporting location'
          : 'reporting locations';
    const sentinelTotal = totalSentinelSites(sentinelSites);
    const sentinelByProgram = new Map(
        sentinelSites.map(row => [row.programId, row.count]),
    );
    const formatNumber = (count: number) => formatter.number(count);
    const hasBreakdown = coverage.length > 1;
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const singleProgram = programById.get(coverage[0]?.programId);

    return (
        // The tile is the click target; its chevron button serves keyboards.
        <article
            className={cn(styles.headline, styles.headlineToggle, 'group')}
            onClick={onToggle}
        >
            <div className="flex items-center justify-between gap-4">
                <h2 className={styles.headlineLabel}>Geographic Coverage</h2>
                <span className={styles.headlineIcon}>
                    <MapPin className="size-[18px]" aria-hidden="true" />
                </span>
            </div>
            <p className={styles.headlineSummary}>
                <span className={styles.headlineValue}>
                    {total === null ? '—' : formatter.number(total)}
                </span>
                <span className={styles.headlineUnit}>
                    {coverage.length === 0
                        ? 'Choose a program'
                        : total === null
                          ? `${totalUnit} unavailable`
                          : `active ${totalUnit}`}
                </span>
                {sentinelTotal !== null && (
                    // Full width, so it starts its own line under the households.
                    <span className={cn(styles.headlineUnit, 'basis-full')}>
                        {formatSentinelSites(sentinelTotal, formatNumber)}
                    </span>
                )}
            </p>
            {expanded && (
                <>
                    {hasBreakdown ? (
                        <ul
                            className={styles.coverageRows}
                            aria-label="Coverage by program"
                        >
                            {coverage.map(entry => {
                                const program = programById.get(
                                    entry.programId,
                                );
                                const sentinel = sentinelByProgram.get(
                                    entry.programId,
                                );
                                return (
                                    <li
                                        className={styles.coverageRow}
                                        key={entry.programId}
                                    >
                                        <div className="min-w-0">
                                            <p
                                                className={
                                                    styles.coverageCountry
                                                }
                                                title={program?.country}
                                            >
                                                {program?.country ||
                                                    'Reporting program'}
                                            </p>
                                            <p
                                                className={
                                                    styles.coverageProgram
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.programName
                                                    }
                                                    title={program?.name}
                                                >
                                                    {program?.name}
                                                </span>
                                            </p>
                                        </div>
                                        {/* Figure and sentinel sites stack in the right-hand column. */}
                                        <div className="text-right">
                                            <p
                                                className={
                                                    styles.coverageFigure
                                                }
                                            >
                                                <span
                                                    className={cn(
                                                        styles.coverageCount,
                                                        entry.count === null &&
                                                            styles.coverageUnavailable,
                                                    )}
                                                >
                                                    {entry.count === null
                                                        ? 'Unavailable'
                                                        : formatter.number(
                                                              entry.count,
                                                          )}
                                                </span>{' '}
                                                <span
                                                    className={
                                                        styles.coverageUnit
                                                    }
                                                >
                                                    {progressLocationUnitLabel(
                                                        entry.unit,
                                                        entry.count,
                                                    )}
                                                </span>
                                            </p>
                                            {sentinel != null && (
                                                <p
                                                    className={
                                                        styles.coverageUnit
                                                    }
                                                >
                                                    {formatSentinelSites(
                                                        sentinel,
                                                        formatNumber,
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : singleProgram ? (
                        <p className={styles.coverageSingleProgram}>
                            {singleProgram.country} · {singleProgram.name}
                        </p>
                    ) : null}
                    <p className={styles.headlineDescription}>
                        {coverage.length > 0 && total === null
                            ? 'Coverage unavailable for some programs. Available counts are shown in the breakdown.'
                            : 'Locations reporting during the selected period.'}
                    </p>
                </>
            )}
            <HeadlineExpandButton
                title="Geographic Coverage"
                expanded={expanded}
            />
        </article>
    );
}
