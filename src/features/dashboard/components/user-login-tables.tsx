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
    buildLoginColumns,
    countLoginsByDayAndMonth,
    type LoginColumn,
} from '@/features/dashboard/utils/build-user-logins';
import { monthStartDate } from '@/features/dashboard/utils/month-key';
import { cn } from '@/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

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
        <Table containerClassName="max-h-96 overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
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

/**
 * One column per day for a single month, per month for longer periods; a month
 * with logins expands into its days.
 */
export function LoginsBreakdownTable({ users, period }: TablesProps) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const columns = buildLoginColumns(period, expanded);
    const monthsWithLogins = new Set(
        users.flatMap(user => user.dailyLogins.map(d => d.date.slice(0, 7))),
    );
    const monthLabel = (month: string) =>
        formatter.dateTime(monthStartDate(month), {
            month: 'short',
            year: '2-digit',
            timeZone: 'UTC',
        });
    // Tints the days of an expanded month so they read as one group.
    const dayTint = (column: LoginColumn) =>
        column.kind === 'day' && expanded.size > 0 ? 'bg-muted/40' : '';

    function toggle(month: string) {
        setExpanded(current => {
            const next = new Set(current);
            if (next.has(month)) next.delete(month);
            else next.add(month);
            return next;
        });
    }

    return (
        <Table containerClassName="max-h-96 overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-20 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow>
                    <TableHead className="bg-card sticky left-0 z-10">
                        {t('name')}
                    </TableHead>
                    {columns.map(column => (
                        <TableHead
                            key={column.key}
                            className={cn(
                                'px-1.5 text-center tabular-nums',
                                dayTint(column),
                            )}
                        >
                            {column.kind === 'day' ? (
                                column.day
                            ) : monthsWithLogins.has(column.key) ? (
                                <button
                                    type="button"
                                    aria-expanded={expanded.has(column.key)}
                                    aria-label={t('toggleDays', {
                                        month: monthLabel(column.key),
                                    })}
                                    onClick={() => toggle(column.key)}
                                    className="hover:bg-muted focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-0.5 outline-none focus-visible:ring-[3px]"
                                >
                                    <ChevronRight
                                        aria-hidden="true"
                                        className={cn(
                                            'size-3.5 transition-transform',
                                            expanded.has(column.key) &&
                                                'rotate-90',
                                        )}
                                    />
                                    {monthLabel(column.key)}
                                </button>
                            ) : (
                                monthLabel(column.key)
                            )}
                        </TableHead>
                    ))}
                    <TableHead className="bg-card sticky right-0 z-10 text-right">
                        {t('total')}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map(user => {
                    const counts = countLoginsByDayAndMonth(user.dailyLogins);
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
                                        className={cn(
                                            'px-1.5 text-center tabular-nums',
                                            !count &&
                                                'text-muted-foreground/40',
                                            dayTint(column),
                                        )}
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
