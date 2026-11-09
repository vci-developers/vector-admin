import type { ProgressSpecies } from '@/api/progress/validation/progress-schema';
import { syncStephensiGlow } from '@/features/dashboard/utils/stephensi-glow';
import { isStephensi } from '@/features/dashboard/utils/stephensi-totals';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { cn } from '@/utils/cn';
import { Bug, ChevronRight } from 'lucide-react';
import { useFormatter } from 'next-intl';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import GlidingNumber from './gliding-number';
import styles from './progress-view.module.css';

/** Specimens per species for the selection: all Programs or one area. */
export default function ProgressSpeciesBreakdown({
    species,
    areaName,
    month = null,
    barTotal = 1,
    onStephensiSelect,
}: {
    species: readonly ProgressSpecies[];
    /** The selected area, or null for the whole selection. */
    areaName: string | null;
    /** The timeline's month: rows then grow and swap places as it moves. */
    month?: string | null;
    /** A full bar: the top species' specimens over the whole period. */
    barTotal?: number;
    /** When given, An. stephensi rows stand out and open its view. */
    onStephensiSelect?: () => void;
}) {
    const formatter = useFormatter();
    const list = useRef<HTMLOListElement>(null);
    const rowTops = useRef(new Map<string, number>());
    const lastMonth = useRef<string | null>(null);

    // Rows re-sort as months pass: glide each from where it just was.
    useLayoutEffect(() => {
        const moving = month !== null;
        // Going back, as Play does from the end, is a reset: keep it quick.
        const rewinding =
            moving && (lastMonth.current === null || month < lastMonth.current);
        lastMonth.current = month;
        if (list.current) list.current.dataset.rewinding = String(rewinding);
        const tops = new Map<string, number>();
        list.current
            ?.querySelectorAll<HTMLElement>(':scope > li')
            .forEach(row => {
                const key = row.dataset.species ?? '';
                const before = rowTops.current.get(key);
                tops.set(key, row.offsetTop);
                if (!moving) return;
                if (before === undefined)
                    row.animate(
                        [
                            { opacity: 0, transform: 'translateX(-10px)' },
                            { opacity: 1, transform: 'none' },
                        ],
                        { duration: 400, easing: 'ease-out' },
                    );
                else if (before !== row.offsetTop)
                    row.animate(
                        [
                            {
                                transform: `translateY(${before - row.offsetTop}px)`,
                            },
                            { transform: 'none' },
                        ],
                        {
                            duration: rewinding ? 250 : 500,
                            easing: 'ease-in-out',
                        },
                    );
            });
        rowTops.current = tops;
    }, [species, month]);

    const upTo =
        month &&
        ` up to ${formatter.dateTime(monthStartDate(month), {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        })}`;

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
                            ? `Specimens by species in ${areaName}${upTo ?? ''}.`
                            : `Specimens by species across the selected programs${upTo ?? ''}.`}
                    </p>
                </div>
            </div>
            {species.length > 0 ? (
                <ol ref={list} className={styles.contributionList}>
                    {species.map(row => {
                        const stephensi =
                            onStephensiSelect !== undefined &&
                            row.name !== null &&
                            isStephensi(row.name);
                        // The timeline marks it with a pink bar instead.
                        const highlighted = stephensi && month === null;
                        const content = (
                            <>
                                <p
                                    className={cn(
                                        styles.contributionArea,
                                        !row.name && 'text-muted-foreground',
                                    )}
                                >
                                    {row.name ?? 'Calibration specimens'}
                                </p>
                                <span className={styles.contributionCount}>
                                    {month ? (
                                        <GlidingNumber value={row.specimens} />
                                    ) : (
                                        formatter.number(row.specimens)
                                    )}
                                    <span className="text-muted-foreground ml-1 font-normal">
                                        {row.specimens === 1
                                            ? 'specimen'
                                            : 'specimens'}
                                    </span>
                                </span>
                            </>
                        );
                        return (
                            <li
                                key={row.name ?? ''}
                                data-species={row.name ?? ''}
                                className={styles.speciesRow}
                            >
                                <span
                                    aria-hidden="true"
                                    className={styles.speciesBar}
                                    data-shown={month !== null}
                                    data-stephensi={stephensi}
                                    style={
                                        {
                                            '--share': Math.min(
                                                1,
                                                row.specimens / barTotal,
                                            ),
                                        } as CSSProperties
                                    }
                                />
                                {highlighted ? (
                                    <button
                                        type="button"
                                        onClick={onStephensiSelect}
                                        ref={syncStephensiGlow}
                                        className={cn(
                                            styles.stephensiRow,
                                            'focus-visible:ring-ring -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2 [&>p]:flex-1',
                                        )}
                                    >
                                        {content}
                                        <ChevronRight
                                            className="size-3.5 shrink-0"
                                            aria-hidden="true"
                                        />
                                    </button>
                                ) : (
                                    <div className="flex items-center justify-between gap-3">
                                        {content}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    No specimens to display for this selection.
                </p>
            )}
        </section>
    );
}
