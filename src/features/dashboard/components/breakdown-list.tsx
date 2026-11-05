'use client';

import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import styles from './progress-view.module.css';

/** A tile's lines. Long lists scroll inside the tile, with a hint below. */
export default function BreakdownList({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    const list = useRef<HTMLUListElement>(null);
    const [scrollable, setScrollable] = useState(false);
    const [more, setMore] = useState(false);
    const measure = useCallback(() => {
        const element = list.current;
        if (!element) return;
        const hidden = element.scrollHeight - element.clientHeight;
        setScrollable(hidden > 1);
        setMore(hidden - element.scrollTop > 1);
    }, []);
    useEffect(() => {
        measure();
        const observer = new ResizeObserver(measure);
        if (list.current) observer.observe(list.current);
        return () => observer.disconnect();
    }, [measure, children]);

    return (
        <div
            className={styles.breakdown}
            // Using the scrollbar shouldn't close the tile around it.
            onClick={scrollable ? event => event.stopPropagation() : undefined}
        >
            <ul
                ref={list}
                aria-label={label}
                className={styles.breakdownList}
                data-more={more || undefined}
                onScroll={measure}
                tabIndex={scrollable ? 0 : undefined}
            >
                {children}
            </ul>
            {scrollable && (
                <p
                    aria-hidden="true"
                    className={cn(styles.breakdownHint, !more && 'invisible')}
                >
                    <ChevronDown className="size-3" />
                    Scroll for more
                </p>
            )}
        </div>
    );
}
