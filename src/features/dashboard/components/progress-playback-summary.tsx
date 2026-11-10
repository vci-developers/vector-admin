'use client';

import { Button } from '@/components/ui/button';
import type { TimelineFigures } from '@/features/dashboard/utils/scans-as-of';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import type { TimelineClock } from '@/features/dashboard/utils/timeline-clock';
import { X } from 'lucide-react';
import { useFormatter } from 'next-intl';
import { useSyncExternalStore } from 'react';
import GlidingNumber from './gliding-number';
import styles from './progress-view.module.css';

/** Line points per month: enough for the curve to look smooth. */
const STEPS_PER_MONTH = 12;

/** Eases between months, so the line curves but never overshoots a month. */
function valueAt(values: readonly number[], position: number): number {
    const whole = Math.floor(position);
    const next = values[whole + 1] ?? values[whole];
    const part = position - whole;
    const eased = part * part * (3 - 2 * part);
    return values[whole] + (next - values[whole]) * eased;
}

/** Scans so far, and the line of scans per month, up to the timeline's position. */
export default function ProgressPlaybackSummary({
    clock,
    title,
    figures,
    stephensi,
    playing,
    onClose,
}: {
    clock: TimelineClock;
    title: string;
    figures: TimelineFigures;
    /** Specimens so far when the An. stephensi filter is on; otherwise null. */
    stephensi: number | null;
    /** Glides between months; stopped, it matches the month shown. */
    playing: boolean;
    onClose: () => void;
}) {
    const formatter = useFormatter();
    const raw = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
    const scans = figures.months.map(row => row.scans);
    const last = scans.length - 1;
    const position = Math.min(last, Math.max(0, raw));
    const whole = Math.floor(position);
    const total =
        scans.slice(0, whole + 1).reduce((sum, count) => sum + count, 0) +
        (playing ? (position - whole) * (scans[whole + 1] ?? 0) : 0);

    const peak = Math.max(1, ...scans);
    const x = (at: number) => (at / last) * 100;
    const y = (at: number) => 100 - (valueAt(scans, at) / peak) * 94;
    const stops = Array.from(
        { length: Math.floor(position * STEPS_PER_MONTH) + 1 },
        (_, step) => step / STEPS_PER_MONTH,
    );
    const line = [...stops, position]
        .map(at => `${x(at).toFixed(2)} ${y(at).toFixed(2)}`)
        .join(' L ');
    const monthLabel = (key: string) =>
        formatter.dateTime(monthStartDate(key), {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });

    return (
        <div className={styles.playback}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2
                        id="progress-chart-heading"
                        className={styles.playbackTitle}
                    >
                        Total scans
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
            <p className={styles.playbackTotal}>
                {formatter.number(Math.round(total))}
            </p>
            {stephensi !== null && (
                <p className={styles.playbackStephensi}>
                    <strong>
                        <GlidingNumber value={stephensi} />
                    </strong>{' '}
                    <em>An. stephensi</em>{' '}
                    {stephensi === 1 ? 'specimen' : 'specimens'}
                </p>
            )}
            <div className={styles.playbackChart} aria-hidden="true">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                        d={`M ${line} L ${x(position).toFixed(2)} 100 L 0 100 Z`}
                        className={styles.playbackArea}
                    />
                    <path
                        d={`M ${line}`}
                        className={styles.playbackLine}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
                <span
                    className={styles.playbackTip}
                    style={{ left: `${x(position)}%`, top: `${y(position)}%` }}
                />
            </div>
            <p className={styles.playbackEnds}>
                <span>{monthLabel(figures.months[0].month)}</span>
                <span>{monthLabel(figures.months[last].month)}</span>
            </p>
            <dl className={styles.playbackStats}>
                {(
                    [
                        ['Specimens', figures.specimens],
                        ['Scans this month', figures.added],
                        ['Areas reporting', figures.areas],
                        ['Countries', figures.countries],
                    ] as const
                ).map(([label, value]) => (
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
