import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressLocationCoverage } from '@/api/progress/validation/progress-schema';
import {
    groupProgressLocationsByUnit,
    progressLocationUnitLabel,
    totalProgressLocations,
} from '@/features/dashboard/utils/format-progress-locations';
import { cn } from '@/utils/cn';
import { MapPin } from 'lucide-react';
import { useFormatter } from 'next-intl';
import styles from './progress-view.module.css';

export default function ProgressCoverageHeadline({
    coverage,
    programs,
}: {
    coverage: readonly ProgressLocationCoverage[];
    programs: readonly Program[];
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
    const hasBreakdown = coverage.length > 1;
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const singleProgram = programById.get(coverage[0]?.programId);

    return (
        <article className={styles.headline}>
            <div className="flex items-center justify-between gap-4">
                <h2 className={styles.headlineLabel}>Geographic coverage</h2>
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
            </p>
            {hasBreakdown ? (
                <ul
                    className={styles.coverageRows}
                    aria-label="Coverage by program"
                >
                    {coverage.map(entry => {
                        const program = programById.get(entry.programId);
                        return (
                            <li
                                className={styles.coverageRow}
                                key={entry.programId}
                            >
                                <div className="min-w-0">
                                    <p
                                        className={styles.coverageCountry}
                                        title={program?.country}
                                    >
                                        {program?.country ||
                                            'Reporting program'}
                                    </p>
                                    <p className={styles.coverageProgram}>
                                        <span
                                            className={styles.programName}
                                            title={program?.name}
                                        >
                                            {program?.name}
                                        </span>
                                    </p>
                                </div>
                                <p className={styles.coverageFigure}>
                                    <span
                                        className={cn(
                                            styles.coverageCount,
                                            entry.count === null &&
                                                styles.coverageUnavailable,
                                        )}
                                    >
                                        {entry.count === null
                                            ? 'Unavailable'
                                            : formatter.number(entry.count)}
                                    </span>{' '}
                                    <span className={styles.coverageUnit}>
                                        {progressLocationUnitLabel(
                                            entry.unit,
                                            entry.count,
                                        )}
                                    </span>
                                </p>
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
                    ? 'Coverage unavailable for some programs.'
                    : 'Locations reporting during the selected period.'}
            </p>
        </article>
    );
}
