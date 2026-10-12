import type { Program } from '@/api/program/validation/program-schema';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useFormatter } from 'next-intl';
import HeadlineExpandButton from './headline-expand-button';
import styles from './progress-view.module.css';

/** A total with one line per Program; used for scans and specimens. */
export default function ProgressCountHeadline({
    title,
    icon: Icon,
    tone,
    total,
    byProgram,
    totalUnit,
    singleUnit,
    description,
    programs,
    expanded,
    onToggle,
}: {
    title: string;
    icon: LucideIcon;
    /** The tiles darken left to right: coverage, scans, specimens. */
    tone: 'mid' | 'dark';
    total: number | null;
    /** `count` is null only when the Program's snapshot could not load. */
    byProgram: readonly { programId: number; count: number | null }[];
    /** Beside the total when several Programs are listed, e.g. "total scans". */
    totalUnit: string;
    /** Beside the total for a single Program. */
    singleUnit: string;
    description: string;
    programs: readonly Program[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const formatter = useFormatter();
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const hasBreakdown = byProgram.length > 1;
    const incomplete = byProgram.some(row => row.count === null);
    const singleProgram = programById.get(byProgram[0]?.programId);

    return (
        <article
            className={cn(
                styles.headline,
                styles.headlineToggle,
                styles.headlineFeatured,
                tone === 'mid' && styles.headlineMid,
                'group',
            )}
            onClick={onToggle}
        >
            <div className="flex items-center justify-between gap-4">
                <h2 className={styles.headlineLabel}>{title}</h2>
                <span className={styles.headlineIcon}>
                    <Icon className="size-[18px]" aria-hidden="true" />
                </span>
            </div>
            <p className={styles.headlineSummary}>
                <span className={styles.headlineValue}>
                    {total === null ? '—' : formatter.number(total)}
                </span>
                <span className={styles.headlineUnit}>
                    {hasBreakdown
                        ? incomplete
                            ? 'total from available programs'
                            : totalUnit
                        : singleUnit}
                </span>
            </p>
            {expanded && (
                <>
                    {hasBreakdown ? (
                        <ul
                            className={styles.scanBreakdown}
                            aria-label={`${title} by program`}
                        >
                            {byProgram.map(row => {
                                const program = programById.get(row.programId);
                                return (
                                    <li
                                        className={styles.scanRow}
                                        key={row.programId}
                                    >
                                        <div className="min-w-0">
                                            <p
                                                className={styles.scanCountry}
                                                title={program?.country}
                                            >
                                                {program?.country ||
                                                    'Reporting program'}
                                            </p>
                                            <p className={styles.scanProgram}>
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
                                        <span
                                            className={
                                                row.count === null
                                                    ? styles.scanUnavailable
                                                    : styles.scanCount
                                            }
                                        >
                                            {row.count === null
                                                ? 'Unavailable'
                                                : formatter.number(row.count)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : singleProgram ? (
                        <p className={styles.scanSingleProgram}>
                            {singleProgram.country} · {singleProgram.name}
                        </p>
                    ) : null}
                    <p className={styles.headlineDescription}>{description}</p>
                </>
            )}
            <HeadlineExpandButton title={title} expanded={expanded} />
        </article>
    );
}
