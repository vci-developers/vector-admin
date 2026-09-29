import type { ProgramData } from './build-period-metrics';
import { monthsInRange, type MonthKey } from './month-key';

export type UserLoginRow = {
    userId: number;
    programId: number;
    name: string | null;
    email: string;
    logins: number;
    /** `YYYY-MM-DD` of the last login in the period. */
    lastLogin: string;
    /** Only days inside the period. */
    dailyLogins: { date: string; count: number }[];
};

type Period = { from: MonthKey; to: MonthKey };

// Logins are UTC days, so the period is compared on the date's month.
export function buildUserLoginRows(
    programs: ProgramData[],
    period: Period,
): UserLoginRow[] {
    return programs
        .flatMap(({ program, snapshot }) =>
            snapshot.userLogins.map(user => {
                const dailyLogins = user.dailyLogins.filter(({ date }) => {
                    const month = date.slice(0, 7);
                    return month >= period.from && month <= period.to;
                });
                return {
                    userId: user.userId,
                    programId: program.programId,
                    name: user.name,
                    email: user.email,
                    logins: dailyLogins.reduce((sum, d) => sum + d.count, 0),
                    lastLogin: dailyLogins.reduce(
                        (last, d) => (d.date > last ? d.date : last),
                        '',
                    ),
                    dailyLogins,
                };
            }),
        )
        .filter(row => row.logins > 0)
        .sort(
            (a, b) =>
                b.logins - a.logins ||
                (a.name ?? a.email).localeCompare(b.name ?? b.email),
        );
}

/** `YYYY-MM-DD` for every day of the month. */
function daysInMonth(month: MonthKey): string[] {
    const [year, monthNumber] = month.split('-').map(Number);
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return Array.from(
        { length: count },
        (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
    );
}

function daysInPeriod({ from, to }: Period): string[] {
    return monthsInRange(from, to).flatMap(daysInMonth);
}

export type LoginColumn =
    /** `foldKey` marks the first month of an unfolded empty run. */
    | { kind: 'month'; key: MonthKey; foldKey?: string }
    | { kind: 'day'; key: string; day: number }
    /** Two or more consecutive months with no logins, folded into one. */
    | { kind: 'folded'; key: string; months: MonthKey[] };

type Folding = {
    monthsWithLogins: ReadonlySet<MonthKey>;
    /** Keys of folded runs the viewer has opened. */
    unfolded: ReadonlySet<string>;
};

/**
 * One column per day for a single month. Longer periods get one per month,
 * each followed by its days when that month is expanded; with `folding`, runs
 * of two or more months without a login collapse into one column.
 */
export function buildLoginColumns(
    period: Period,
    expandedMonths: ReadonlySet<MonthKey>,
    folding?: Folding,
): LoginColumn[] {
    const months = monthsInRange(period.from, period.to);
    const days = (month: MonthKey): LoginColumn[] =>
        daysInMonth(month).map((key, i) => ({ kind: 'day', key, day: i + 1 }));
    if (months.length === 1) return days(months[0]);
    const monthColumns = (month: MonthKey, foldKey?: string): LoginColumn[] => [
        { kind: 'month', key: month, ...(foldKey ? { foldKey } : {}) },
        ...(expandedMonths.has(month) ? days(month) : []),
    ];
    if (!folding) return months.flatMap(month => monthColumns(month));

    const columns: LoginColumn[] = [];
    let run: MonthKey[] = [];
    const flush = () => {
        const key = `fold:${run[0]}`;
        if (run.length >= 2 && !folding.unfolded.has(key)) {
            columns.push({ kind: 'folded', key, months: run });
        } else {
            run.forEach((month, i) =>
                columns.push(
                    ...monthColumns(
                        month,
                        run.length >= 2 && i === 0 ? key : undefined,
                    ),
                ),
            );
        }
        run = [];
    };
    for (const month of months) {
        if (folding.monthsWithLogins.has(month)) {
            flush();
            columns.push(...monthColumns(month));
        } else {
            run.push(month);
        }
    }
    flush();
    return columns;
}

/** Login counts keyed by both `YYYY-MM-DD` and `YYYY-MM`. */
export function countLoginsByDayAndMonth(
    dailyLogins: UserLoginRow['dailyLogins'],
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { date, count } of dailyLogins) {
        for (const key of [date, date.slice(0, 7)]) {
            counts.set(key, (counts.get(key) ?? 0) + count);
        }
    }
    return counts;
}

export type SheetRows = (string | number)[][];

/** Same sheets as the backend's user login report, plus a Program column. */
export function buildLoginReportSheets(
    rows: UserLoginRow[],
    period: Period,
    programNames: Map<number, string>,
): { uniqueUsers: SheetRows; dailyLogins: SheetRows } {
    const program = (row: UserLoginRow) =>
        programNames.get(row.programId) ?? String(row.programId);
    const days = daysInPeriod(period);
    return {
        uniqueUsers: [
            ['Program', 'Name', 'Email', 'Total Logins'],
            ...rows.map(row => [
                program(row),
                row.name ?? '',
                row.email,
                row.logins,
            ]),
        ],
        dailyLogins: [
            ['Program', 'Name', 'Email', ...days, 'Total Logins'],
            ...rows.map(row => {
                const byDate = new Map(
                    row.dailyLogins.map(d => [d.date, d.count]),
                );
                return [
                    program(row),
                    row.name ?? '',
                    row.email,
                    ...days.map(day => byDate.get(day) ?? 0),
                    row.logins,
                ];
            }),
        ],
    };
}
