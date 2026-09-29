import type { ProgramSnapshot } from '@/api/admin/load-program-snapshot';
import type { UserLoginActivity } from '@/api/user/validation/login-activity-schema';
import { describe, expect, it } from 'vitest';
import type { ProgramData } from './build-period-metrics';
import {
    buildLoginColumns,
    buildLoginReportSheets,
    buildUserLoginRows,
    countLoginsByDayAndMonth,
} from './build-user-logins';

function program(
    programId: number,
    userLogins: UserLoginActivity[],
): ProgramData {
    const snapshot: ProgramSnapshot = {
        programId,
        sessions: [],
        specimens: [],
        devices: [],
        collectionCycles: [],
        userLogins,
        sites: [],
        fetchedAt: 0,
    };
    return {
        program: { programId, name: `Program ${programId}`, country: 'Uganda' },
        snapshot,
    };
}

const ada: UserLoginActivity = {
    userId: 1,
    name: 'Ada',
    email: 'ada@example.org',
    dailyLogins: [
        { date: '2026-01-31', count: 2 },
        { date: '2026-02-01', count: 3 },
        { date: '2026-03-01', count: 9 },
    ],
};
const bo: UserLoginActivity = {
    userId: 2,
    name: null,
    email: 'bo@example.org',
    dailyLogins: [{ date: '2026-02-10', count: 7 }],
};
const february = { from: '2026-02', to: '2026-02' };

describe('buildUserLoginRows', () => {
    it("keeps only the period's logins, drops inactive users, most active first", () => {
        const rows = buildUserLoginRows(
            [program(7, [ada, bo]), program(9, [])],
            february,
        );

        expect(rows.map(r => [r.email, r.logins, r.lastLogin])).toEqual([
            ['bo@example.org', 7, '2026-02-10'],
            ['ada@example.org', 3, '2026-02-01'],
        ]);
        expect(
            buildUserLoginRows([program(7, [ada])], {
                from: '2025-11',
                to: '2025-12',
            }),
        ).toEqual([]);
    });
});

describe('buildLoginReportSheets', () => {
    it('matches the backend report columns with a Program column and every day', () => {
        const rows = buildUserLoginRows([program(7, [ada])], february);
        const sheets = buildLoginReportSheets(
            rows,
            february,
            new Map([[7, 'Uganda NMED']]),
        );

        expect(sheets.uniqueUsers).toEqual([
            ['Program', 'Name', 'Email', 'Total Logins'],
            ['Uganda NMED', 'Ada', 'ada@example.org', 3],
        ]);
        const [header, row] = sheets.dailyLogins;
        expect(header).toHaveLength(3 + 28 + 1);
        expect([header[3], header.at(-2), header.at(-1)]).toEqual([
            '2026-02-01',
            '2026-02-28',
            'Total Logins',
        ]);
        expect([row[3], row[4], row.at(-1)]).toEqual([3, 0, 3]);
    });
});

describe('buildLoginColumns', () => {
    const keys = (columns: { key: string }[]) => columns.map(c => c.key);

    it('lists every day for a single month', () => {
        const columns = buildLoginColumns(
            { from: '2026-02', to: '2026-02' },
            new Set(),
        );
        expect(columns).toHaveLength(28);
        expect(columns[0]).toEqual({ kind: 'day', key: '2026-02-01', day: 1 });
    });

    it("puts an expanded month's days right after that month", () => {
        const columns = buildLoginColumns(
            { from: '2026-05', to: '2026-07' },
            new Set(['2026-06']),
        );
        expect(keys(columns).slice(0, 3)).toEqual([
            '2026-05',
            '2026-06',
            '2026-06-01',
        ]);
        expect(keys(columns).slice(-2)).toEqual(['2026-06-30', '2026-07']);
        expect(columns).toHaveLength(33);
    });
});

describe('countLoginsByDayAndMonth', () => {
    it('counts each day and adds it to its month', () => {
        const counts = countLoginsByDayAndMonth([
            { date: '2026-06-03', count: 2 },
            { date: '2026-06-14', count: 1 },
            { date: '2026-07-01', count: 4 },
        ]);
        expect(counts.get('2026-06-03')).toBe(2);
        expect(counts.get('2026-06')).toBe(3);
        expect(counts.get('2026-07')).toBe(4);
        expect(counts.has('2026-06-04')).toBe(false);
    });
});
