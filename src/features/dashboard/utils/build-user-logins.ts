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
    | { kind: 'month'; key: MonthKey }
    | { kind: 'day'; key: string; day: number };

/**
 * One column per day for a single month. Longer periods get one per month,
 * each followed by its days when that month is expanded.
 */
export function buildLoginColumns(
    period: Period,
    expandedMonths: ReadonlySet<MonthKey>,
): LoginColumn[] {
    const months = monthsInRange(period.from, period.to);
    const days = (month: MonthKey): LoginColumn[] =>
        daysInMonth(month).map((key, i) => ({ kind: 'day', key, day: i + 1 }));
    if (months.length === 1) return days(months[0]);
    return months.flatMap(month => [
        { kind: 'month', key: month } as LoginColumn,
        ...(expandedMonths.has(month) ? days(month) : []),
    ]);
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
