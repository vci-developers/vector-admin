import type { Program } from '@/api/program/validation/program-schema';
import { groupRowsByCountry } from '@/features/dashboard/utils/group-rows-by-country';
import type { ReactNode } from 'react';
import BreakdownList from './breakdown-list';
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
 * nested under its subtotal.
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
        <BreakdownList label={label}>
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
        </BreakdownList>
    );
}
