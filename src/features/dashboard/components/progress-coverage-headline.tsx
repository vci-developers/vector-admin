import type { Program } from '@/api/program/validation/program-schema';
import type {
    ProgressLocationCoverage,
    ProgressSentinelSites,
} from '@/api/progress/validation/progress-schema';
import {
    locationTotalUnit,
    sentinelSiteLabel,
    sumAvailableCounts,
    totalProgressLocations,
    totalSentinelSites,
} from '@/features/dashboard/utils/format-progress-locations';
import { cn } from '@/utils/cn';
import { MapPin } from 'lucide-react';
import { useFormatter } from 'next-intl';
import HeadlineExpandButton from './headline-expand-button';
import ProgramBreakdown from './program-breakdown';
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
    // A location uses its program's reporting level, retained in the breakdown.
    // A Program without a count is left out of the total and marked below.
    const total = totalProgressLocations(coverage);
    const totalUnit = locationTotalUnit(coverage, total);
    const sentinelTotal = totalSentinelSites(sentinelSites);
    const sentinelByProgram = new Map(
        sentinelSites.map(row => [row.programId, row.count]),
    );
    const hasBreakdown = coverage.length > 1;
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const singleProgram = programById.get(coverage[0]?.programId);
    // Sentinel sites lead: they are counted the same way in every Program.
    const figure = (rows: readonly ProgressLocationCoverage[]) => {
        const sentinel = sumAvailableCounts(
            rows.map(row => sentinelByProgram.get(row.programId) ?? null),
        );
        const count = totalProgressLocations(rows);
        return (
            <div className="text-right">
                {sentinel !== null && (
                    <p className={styles.coverageFigure}>
                        <span className={styles.coverageCount}>
                            {formatter.number(sentinel)}
                        </span>{' '}
                        <span className={styles.coverageUnit}>
                            {sentinelSiteLabel(sentinel)}
                        </span>
                    </p>
                )}
                <p className={styles.coverageFigure}>
                    <span
                        className={cn(
                            sentinel === null
                                ? styles.coverageCount
                                : styles.coverageUnit,
                            count === null && styles.coverageUnavailable,
                        )}
                    >
                        {count === null
                            ? 'Unavailable'
                            : formatter.number(count)}
                    </span>{' '}
                    <span className={styles.coverageUnit}>
                        {locationTotalUnit(rows, count)}
                    </span>
                </p>
            </div>
        );
    };

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
                    {sentinelTotal === null
                        ? '—'
                        : formatter.number(sentinelTotal)}
                </span>
                <span className={styles.headlineUnit}>
                    {coverage.length === 0
                        ? 'Choose a program'
                        : sentinelTotal === null
                          ? 'sentinel sites unavailable'
                          : `active ${sentinelSiteLabel(sentinelTotal)}`}
                </span>
                {coverage.length > 0 && (
                    // Full width, so it starts its own line under the sites.
                    <span className={cn(styles.headlineUnit, 'basis-full')}>
                        {total === null
                            ? `${totalUnit} unavailable`
                            : `${formatter.number(total)} active ${totalUnit}`}
                    </span>
                )}
            </p>
            {expanded && (
                <>
                    {hasBreakdown ? (
                        <ProgramBreakdown
                            rows={coverage}
                            programs={programById}
                            label="Coverage by program"
                            tone="coverage"
                            figure={figure}
                        />
                    ) : singleProgram ? (
                        <p className={styles.coverageSingleProgram}>
                            {singleProgram.country} · {singleProgram.name}
                        </p>
                    ) : null}
                    <p className={styles.headlineDescription}>
                        {coverage.some(entry => entry.count === null)
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
