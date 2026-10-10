import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressProgramScans } from '@/api/progress/validation/progress-schema';
import { ScanLine } from 'lucide-react';
import { useFormatter } from 'next-intl';
import styles from './progress-view.module.css';

export default function ProgressScansHeadline({
    total,
    scansByProgram,
    programs,
}: {
    total: number | null;
    scansByProgram: readonly ProgressProgramScans[];
    programs: readonly Program[];
}) {
    const formatter = useFormatter();
    const programById = new Map(
        programs.map(program => [program.programId, program]),
    );
    const hasBreakdown = scansByProgram.length > 1;
    const incomplete = scansByProgram.some(row => row.scans === null);
    const singleProgram = programById.get(scansByProgram[0]?.programId);

    return (
        <article className={`${styles.headline} ${styles.headlineFeatured}`}>
            <div className="flex items-center justify-between gap-4">
                <h2 className={styles.headlineLabel}>Data captured</h2>
                <span className={styles.headlineIcon}>
                    <ScanLine className="size-[18px]" aria-hidden="true" />
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
                            : 'total scans'
                        : 'images captured with VectorCam'}
                </span>
            </p>
            {hasBreakdown ? (
                <ul
                    className={styles.scanBreakdown}
                    aria-label="Scans by program"
                >
                    {scansByProgram.map(row => {
                        const program = programById.get(row.programId);
                        return (
                            <li className={styles.scanRow} key={row.programId}>
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
                                            className={styles.programName}
                                            title={program?.name}
                                        >
                                            {program?.name}
                                        </span>
                                    </p>
                                </div>
                                <span
                                    className={
                                        row.scans === null
                                            ? styles.scanUnavailable
                                            : styles.scanCount
                                    }
                                >
                                    {row.scans === null
                                        ? 'Unavailable'
                                        : formatter.number(row.scans)}
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
            <p className={styles.headlineDescription}>
                One image is one scan. A specimen with two images contributes
                two scans.
            </p>
        </article>
    );
}
