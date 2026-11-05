'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { groupRowsByCountry } from '@/features/dashboard/utils/group-rows-by-country';
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

const rowStyles = {
    coverage: {
        row: styles.coverageRow,
        country: styles.coverageCountry,
        program: styles.coverageProgram,
    },
    scan: {
        row: styles.scanRow,
        country: styles.scanCountry,
        program: styles.scanProgram,
    },
};

/**
 * A headline tile's lines, one per country with a country's several Programs
 * nested under its subtotal. Long lists scroll inside the tile.
 */
export default function ProgramBreakdown<Row extends { programId: number }>({
    rows,
    programs,
    label,
    tone,
    figure,
}: {
    rows: readonly Row[];
    programs: ReadonlyMap<number, Program>;
    label: string;
    tone: keyof typeof rowStyles;
    /** The figure for one Program, or for all of a country's Programs. */
    figure: (rows: readonly Row[]) => ReactNode;
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
    }, [measure, rows]);
    const classes = rowStyles[tone];

    const programName = (row: Row) => {
        const name = programs.get(row.programId)?.name;
        return (
            <p className={classes.program}>
                <span className={styles.programName} title={name}>
                    {name}
                </span>
            </p>
        );
    };

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
                {groupRowsByCountry(rows, programs).map(
                    ({ country, rows: group }) => {
                        const heading = (
                            <p
                                className={classes.country}
                                title={country ?? undefined}
                            >
                                {country ?? 'Reporting program'}
                            </p>
                        );
                        if (group.length === 1)
                            return (
                                <li
                                    className={classes.row}
                                    key={group[0].programId}
                                >
                                    <div className="min-w-0">
                                        {heading}
                                        {programName(group[0])}
                                    </div>
                                    {figure(group)}
                                </li>
                            );
                        return (
                            <li key={country}>
                                <div className={classes.row}>
                                    <div className="min-w-0">
                                        {heading}
                                        <p className={classes.program}>
                                            {group.length} programs
                                        </p>
                                    </div>
                                    {figure(group)}
                                </div>
                                <ul className={styles.countryPrograms}>
                                    {group.map(row => (
                                        <li
                                            className={classes.row}
                                            key={row.programId}
                                        >
                                            <div className="min-w-0">
                                                {programName(row)}
                                            </div>
                                            {figure([row])}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        );
                    },
                )}
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
