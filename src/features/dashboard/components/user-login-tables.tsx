'use client';

import type { UserLogins } from '@/api/user-logins/validation/user-logins-schema';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    monthsInRange,
    monthStartDate,
} from '@/features/dashboard/utils/month-key';
import { useFormatter, useTranslations } from 'next-intl';

type UserRow = UserLogins['users'][number];

type TablesProps = {
    users: UserRow[];
    period: { from: string; to: string };
    programNames: Map<number, string>;
    programColors: Map<number, string>;
};

function ProgramCell({
    programId,
    programNames,
    programColors,
}: {
    programId: number;
    programNames: Map<number, string>;
    programColors: Map<number, string>;
}) {
    return (
        <span className="flex items-center gap-2">
            <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: programColors.get(programId) }}
            />
            {programNames.get(programId) ?? programId}
        </span>
    );
}

export function UsersTable({
    users,
    programNames,
    programColors,
}: TablesProps) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    return (
        <Table>
            <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('program')}</TableHead>
                    <TableHead className="text-right">{t('logins')}</TableHead>
                    <TableHead>{t('lastLogin')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map(user => (
                    <TableRow key={user.userId}>
                        <TableCell className="font-medium">
                            {user.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {user.email}
                        </TableCell>
                        <TableCell>
                            <ProgramCell
                                programId={user.programId}
                                programNames={programNames}
                                programColors={programColors}
                            />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {user.logins}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                            {formatter.dateTime(
                                new Date(`${user.lastLogin}T00:00:00Z`),
                                {
                                    dateStyle: 'medium',
                                    timeZone: 'UTC',
                                },
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

/** One column per day for a single month, per month for longer periods. */
export function LoginsBreakdownTable({ users, period }: TablesProps) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    const months = monthsInRange(period.from, period.to);
    const byDay = months.length === 1;
    const [year, monthNumber] = period.from.split('-').map(Number);
    const columns = byDay
        ? Array.from(
              { length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() },
              (_, i) => ({
                  key: `${period.from}-${String(i + 1).padStart(2, '0')}`,
                  label: String(i + 1),
              }),
          )
        : months.map(month => ({
              key: month,
              label: formatter.dateTime(monthStartDate(month), {
                  month: 'short',
                  year: '2-digit',
                  timeZone: 'UTC',
              }),
          }));
    const keyOf = (date: string) => (byDay ? date : date.slice(0, 7));

    return (
        <Table>
            <TableHeader className="bg-card sticky top-0 z-20">
                <TableRow>
                    <TableHead className="bg-card sticky left-0 z-10">
                        {t('name')}
                    </TableHead>
                    {columns.map(column => (
                        <TableHead
                            key={column.key}
                            className="px-1.5 text-center tabular-nums"
                        >
                            {column.label}
                        </TableHead>
                    ))}
                    <TableHead className="bg-card sticky right-0 z-10 text-right">
                        {t('total')}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map(user => {
                    const counts = new Map<string, number>();
                    for (const { date, count } of user.dailyLogins) {
                        counts.set(
                            keyOf(date),
                            (counts.get(keyOf(date)) ?? 0) + count,
                        );
                    }
                    return (
                        <TableRow key={user.userId}>
                            <TableCell
                                className="bg-card sticky left-0 max-w-48 truncate font-medium"
                                title={user.email}
                            >
                                {user.name ?? user.email}
                            </TableCell>
                            {columns.map(column => {
                                const count = counts.get(column.key);
                                return (
                                    <TableCell
                                        key={column.key}
                                        className={`px-1.5 text-center tabular-nums ${count ? '' : 'text-muted-foreground/40'}`}
                                    >
                                        {count ?? 0}
                                    </TableCell>
                                );
                            })}
                            <TableCell className="bg-card sticky right-0 text-right font-medium tabular-nums">
                                {user.logins}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
