'use client';

import { useFormatter } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';

/** One timeline month, so counts never pause between months. */
const GLIDE_MS = 900;
/** Counts only fall when the timeline goes back, which should be quick. */
const RESET_MS = 250;

/**
 * A number that counts to its new value, writing to the page directly. Only
 * the timeline uses it, so it moves only when someone starts it, and it does
 * so under Reduce Motion too.
 */
export default function GlidingNumber({ value }: { value: number }) {
    const formatter = useFormatter();
    const [initial] = useState(() => formatter.number(value));
    const element = useRef<HTMLSpanElement>(null);
    const shown = useRef(value);

    useLayoutEffect(() => {
        const write = (next: number) => {
            shown.current = next;
            if (element.current)
                element.current.textContent = formatter.number(
                    Math.round(next),
                );
        };
        const from = shown.current;
        const duration = value < from ? RESET_MS : GLIDE_MS;
        const start = performance.now();
        let frame = 0;
        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            write(from + (value - from) * progress);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, formatter]);

    return <span ref={element}>{initial}</span>;
}
