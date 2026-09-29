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

function daysInPeriod({ from, to }: Period): string[] {
    const days: string[] = [];
    for (const month of monthsInRange(from, to)) {
        const [year, monthNumber] = month.split('-').map(Number);
        const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
        for (let day = 1; day <= count; day++) {
            days.push(`${month}-${String(day).padStart(2, '0')}`);
        }
    }
    return days;
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
