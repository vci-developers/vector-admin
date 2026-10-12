import type { ProgressSpecies } from '@/api/progress/validation/progress-schema';
import { cn } from '@/utils/cn';
import { Bug } from 'lucide-react';
import { useFormatter } from 'next-intl';
import styles from './progress-view.module.css';

/** Specimens per species for the selection: all Programs or one area. */
export default function ProgressSpeciesBreakdown({
    species,
    areaName,
}: {
    species: readonly ProgressSpecies[];
    /** The selected area, or null for the whole selection. */
    areaName: string | null;
}) {
    const formatter = useFormatter();

    return (
        <section
            aria-labelledby="progress-species-heading"
            className={styles.areaContributions}
        >
            <div className="flex shrink-0 items-start gap-3">
                <span className={styles.contributionsIcon}>
                    <Bug className="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h3
                        id="progress-species-heading"
                        className="text-sm font-semibold"
                    >
                        Species breakdown
                    </h3>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                        {areaName
                            ? `Specimens by species in ${areaName}.`
                            : 'Specimens by species across the selected programs.'}
                    </p>
                </div>
            </div>
            {species.length > 0 ? (
                <ol className={styles.contributionList}>
                    {species.map(row => (
                        <li key={row.name ?? ''} className={styles.speciesRow}>
                            <div className="flex items-center justify-between gap-3">
                                <p
                                    className={cn(
                                        styles.contributionArea,
                                        row.name
                                            ? 'italic'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    {row.name ?? 'Calibration specimens'}
                                </p>
                                <span className={styles.contributionCount}>
                                    {formatter.number(row.specimens)}
                                    <span className="text-muted-foreground ml-1 font-normal">
                                        {row.specimens === 1
                                            ? 'specimen'
                                            : 'specimens'}
                                    </span>
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    No specimens to display for this selection.
                </p>
            )}
        </section>
    );
}
