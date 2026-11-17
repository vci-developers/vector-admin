'use client';

import { Button } from '@/components/ui/button';
import type { TimelineClock } from '@/features/dashboard/utils/timeline-clock';
import { X } from 'lucide-react';
import { useFormatter } from 'next-intl';
import { useSyncExternalStore, type ReactNode } from 'react';
import GlidingNumber from './gliding-number';
import styles from './progress-view.module.css';

/**
 * The running total so far (scans, or An. stephensi specimens), and the bars
 * per month, up to the timeline's position.
 */
export default function ProgressPlaybackSummary({
    clock,
    heading,
    title,
    monthly,
    stats,
    stephensi = false,
    playing,
    chart,
    onClose,
}: {
    clock: TimelineClock;
    heading: ReactNode;
    title: string;
    /** The count in each month of the period, summed for the total. */
    monthly: readonly number[];
    stats: readonly (readonly [label: string, value: number])[];
    /** The total in the stephensi colour. */
    stephensi?: boolean;
    /** Glides between months; stopped, it matches the month shown. */
    playing: boolean;
    /** The monthly bars, growing in as the timeline reaches each month. */
    chart: ReactNode;
    onClose: () => void;
}) {
    const formatter = useFormatter();
    const raw = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
    const last = monthly.length - 1;
    const position = Math.min(last, Math.max(0, raw));
    const whole = Math.floor(position);
    const total =
        monthly.slice(0, whole + 1).reduce((sum, count) => sum + count, 0) +
        (playing ? (position - whole) * (monthly[whole + 1] ?? 0) : 0);

    return (
        <div className={styles.playback}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2
                        id="progress-chart-heading"
                        className={styles.playbackTitle}
                    >
                        {heading}
                    </h2>
                    <p className="text-muted-foreground text-[11px]">{title}</p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label="Back to the monthly chart"
                    onClick={onClose}
                >
                    <X className="size-4" aria-hidden="true" />
                </Button>
            </div>
            <p
                className={styles.playbackTotal}
                data-stephensi={stephensi || undefined}
            >
                {formatter.number(Math.round(total))}
            </p>
            <div className="-mb-2">{chart}</div>
            <dl className={styles.playbackStats}>
                {stats.map(([label, value]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                            <GlidingNumber value={value} />
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
