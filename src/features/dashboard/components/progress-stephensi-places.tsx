import type { Program } from '@/api/program/validation/program-schema';
import type { ProgressStephensi } from '@/api/progress/validation/progress-schema';
import { usePeriodLabel } from '@/features/dashboard/hooks/use-period-label';
import { cn } from '@/utils/cn';
import { MapPin } from 'lucide-react';
import { useFormatter } from 'next-intl';
import ProgramLabel from './program-label';
import styles from './progress-view.module.css';

/** Where An. stephensi was found, per Program and label as the API names it. */
export default function ProgressStephensiPlaces({
    rows,
    programs,
    selectedKey,
    onSelect,
}: {
    rows: readonly ProgressStephensi[];
    programs: readonly Program[];
    selectedKey: string | null;
    onSelect: (districtKey: string) => void;
}) {
    const formatter = useFormatter();
    const periodLabel = usePeriodLabel();

    return (
        <section
            aria-labelledby="progress-stephensi-heading"
            className={styles.areaContributions}
        >
            <div className="flex shrink-0 items-start gap-3">
                <span
                    className={styles.contributionsIcon}
                    style={{ color: 'var(--progress-stephensi)' }}
                >
                    <MapPin className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3
                        id="progress-stephensi-heading"
                        className="text-sm font-semibold"
                    >
                        Where <span className="italic">An. stephensi</span> was
                        found
                    </h3>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                        Specimens per area. Select an area to chart it.
                    </p>
                </div>
            </div>
            {rows.length > 0 ? (
                <ol className={styles.contributionList}>
                    {rows.map(row => (
                        <li
                            key={`${row.programId}:${row.species}`}
                            className={styles.speciesRow}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <ProgramLabel
                                    program={programs.find(
                                        program =>
                                            program.programId === row.programId,
                                    )}
                                    className="text-sm font-medium"
                                />
                                <span className={styles.contributionCount}>
                                    {formatter.number(row.specimens)}
                                </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5 text-[11px]">
                                <span className="italic">{row.species}</span>
                                {' · last seen '}
                                {periodLabel(row.latestMonth, row.latestMonth)}
                            </p>
                            <ul className="mt-1.5 flex flex-col">
                                {row.districts.map(district => (
                                    <li key={district.key}>
                                        <button
                                            type="button"
                                            aria-pressed={
                                                selectedKey === district.key
                                            }
                                            onClick={() =>
                                                onSelect(district.key)
                                            }
                                            className={cn(
                                                'focus-visible:ring-ring hover:bg-muted flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-xs outline-none focus-visible:ring-2',
                                                selectedKey === district.key &&
                                                    'bg-muted font-medium',
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span
                                                    aria-hidden="true"
                                                    className="size-2 rounded-full"
                                                    style={{
                                                        background:
                                                            'var(--progress-stephensi)',
                                                    }}
                                                />
                                                {district.name}
                                            </span>
                                            {formatter.number(
                                                district.specimens,
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    None found in the selected programs this period.
                </p>
            )}
        </section>
    );
}
