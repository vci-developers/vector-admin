'use client';

import type { ProgressMonth } from '@/api/progress/validation/progress-schema';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import type { TimelineClock } from '@/features/dashboard/utils/timeline-clock';
import { Pause, Play } from 'lucide-react';
import { useFormatter } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './progress-view.module.css';

const MS_PER_MONTH = 900;

/**
 * Moves the map through the period; null is the period's last month. The
 * handle glides between months on `clock`, while the page hears whole ones.
 */
export default function ProgressMapTimeline({
    months,
    month,
    onChange,
    playing,
    onPlayingChange,
    clock,
}: {
    months: readonly ProgressMonth[];
    month: string | null;
    onChange: (month: string | null) => void;
    playing: boolean;
    onPlayingChange: (playing: boolean) => void;
    clock: TimelineClock;
}) {
    const formatter = useFormatter();
    const last = months.length - 1;
    // Nothing scanned in the period: nothing to play or scrub through.
    const empty = months.every(row => row.uniqueScans === 0);
    const found = months.findIndex(row => row.month === month);
    const index = found === -1 ? last : found;
    const [position, setPosition] = useState(index);
    // What the handle last told the page, to tell its own moves from others'.
    const told = useRef(index);

    const moveTo = (next: number) => {
        const clamped = Math.min(last, Math.max(0, next));
        setPosition(clamped);
        clock.set(clamped);
        const whole = Math.floor(clamped);
        if (whole !== told.current) {
            told.current = whole;
            onChange(whole >= last ? null : months[whole].month);
        }
    };
    const moveRef = useRef(moveTo);
    useEffect(() => {
        moveRef.current = moveTo;
    });

    // The page can move the month too, as when the panel closes.
    useEffect(() => {
        clock.set(index);
        if (index === told.current) return;
        told.current = index;
        setPosition(index);
    }, [index, clock]);

    const positionRef = useRef(position);
    useEffect(() => {
        positionRef.current = position;
    }, [position]);
    useEffect(() => {
        if (!playing) return;
        let frame = 0;
        let previous = performance.now();
        const tick = (now: number) => {
            const next = positionRef.current + (now - previous) / MS_PER_MONTH;
            previous = now;
            positionRef.current = next;
            moveRef.current(next);
            if (next >= last) onPlayingChange(false);
            else frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing, last, onPlayingChange]);
    // Leaving mid-run mustn't start it again on return.
    useEffect(() => () => onPlayingChange(false), [onPlayingChange]);

    const label = (key: string) =>
        formatter.dateTime(monthStartDate(key), {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        });
    const current = label(months[Math.min(last, Math.floor(position))].month);

    return (
        <div className={styles.mapTimeline} data-playing={playing}>
            <button
                type="button"
                className={styles.mapTimelinePlay}
                aria-label={playing ? 'Pause' : 'Play through the months'}
                disabled={empty}
                title={empty ? 'No data to play in this period' : undefined}
                onClick={() => {
                    if (!playing && position >= last) {
                        positionRef.current = 0;
                        moveTo(0);
                    }
                    onPlayingChange(!playing);
                }}
            >
                {playing ? (
                    <Pause
                        className="size-4"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden="true"
                    />
                ) : (
                    <Play
                        className="ml-0.5 size-4"
                        fill="currentColor"
                        strokeWidth={0}
                        aria-hidden="true"
                    />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <p className={styles.mapTimelineLabel}>
                    <span>{label(months[0].month)}</span>
                    <strong>Cumulative to {current}</strong>
                    <span>{label(months[last].month)}</span>
                </p>
                <input
                    type="range"
                    className={styles.mapTimelineRange}
                    aria-label="Show the map up to this month"
                    disabled={empty}
                    aria-valuetext={current}
                    min={0}
                    max={last}
                    step={0.01}
                    value={position}
                    style={
                        {
                            '--fill': `${(position / last) * 100}%`,
                        } as CSSProperties
                    }
                    onChange={event => {
                        onPlayingChange(false);
                        moveTo(Number(event.target.value));
                    }}
                />
            </div>
        </div>
    );
}
