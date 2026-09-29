'use client';

import type { Program } from '@/api/program/validation/program-schema';
import type { UserLogins } from '@/api/user-logins/validation/user-logins-schema';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
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
import ProgramLabel from './program-label';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

type UserRow = UserLogins['users'][number];

type TablesProps = {
    users: UserRow[];
    period: { from: string; to: string };
    programs: Map<number, Program>;
    programColors: Map<number, string>;
};

function ProgramCell({
    programId,
    programs,
    programColors,
}: {
    programId: number;
    programs: Map<number, Program>;
    programColors: Map<number, string>;
}) {
    return (
        <span className="flex items-center gap-2">
            <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: programColors.get(programId) }}
            />
            <ProgramLabel program={programs.get(programId)} />
        </span>
    );
}

export function UsersTable({ users, programs, programColors }: TablesProps) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    return (
        <Table containerClassName="max-h-96 overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--border)]">
                <TableRow>
                    <TableHead className="w-10 text-right">
                        <span className="sr-only">{t('rank')}</span>#
                    </TableHead>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('email')}</TableHead>
                    <TableHead>{t('program')}</TableHead>
                    <TableHead className="text-right">{t('logins')}</TableHead>
                    <TableHead>{t('lastLogin')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user, index) => (
                    <TableRow key={user.userId}>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                            {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                            {user.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {user.email}
                        </TableCell>
                        <TableCell>
                            <ProgramCell
                                programId={user.programId}
                                programs={programs}
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
            {/* Stuck to the bottom so the total stays in view while scrolling;
                1px past the edge so no half-covered pixel row shows through. */}
            <TableFooter className="[&_td]:bg-card sticky -bottom-px z-10 font-semibold [&_td]:shadow-[inset_0_1px_0_var(--border)]">
                <TableRow>
                    <TableCell />
                    <TableCell colSpan={3}>
                        {t('totalUsers', { count: users.length })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                        {formatter.number(
                            users.reduce((sum, user) => sum + user.logins, 0),
                        )}
                    </TableCell>
                    <TableCell />
                </TableRow>
            </TableFooter>
        </Table>
    );
}

/**
 * One column per day for a single month, per month for longer periods; a month
 * with logins expands into its days, and runs of months without any logins
 * start folded into one narrow column that opens on click.
 */
export function LoginsBreakdownTable({ users, period }: TablesProps) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
    const monthsWithLogins = new Set(
        users.flatMap(user => user.dailyLogins.map(d => d.date.slice(0, 7))),
    );
    const columns = buildLoginColumns(period, expanded, {
        monthsWithLogins,
        unfolded,
    });
    const columnTotals = countLoginsByDayAndMonth(
        users.flatMap(user => user.dailyLogins),
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

    const toggleIn = (setter: typeof setExpanded) => (key: string) =>
        setter(current => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    const toggle = toggleIn(setExpanded);
    const toggleFold = toggleIn(setUnfolded);
    const runLabel = (months: string[]) => {
        const first = monthStartDate(months[0]);
        const last = months[months.length - 1];
        const sameYear = months[0].slice(0, 4) === last.slice(0, 4);
        return `${formatter.dateTime(first, {
            month: 'short',
            ...(sameYear ? {} : { year: '2-digit' }),
            timeZone: 'UTC',
        })}–${monthLabel(last)}`;
    };
    const headerButton =
        'hover:bg-muted focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-0.5 whitespace-nowrap outline-none focus-visible:ring-[3px]';

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
                            ) : column.kind === 'folded' ? (
                                <button
                                    type="button"
                                    aria-expanded={false}
                                    title={t('foldedMonths', {
                                        range: runLabel(column.months),
                                    })}
                                    onClick={() => toggleFold(column.key)}
                                    className={cn(
                                        headerButton,
                                        'text-muted-foreground',
                                    )}
                                >
                                    <ChevronRight
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                    {runLabel(column.months)}
                                </button>
                            ) : column.foldKey ? (
                                <button
                                    type="button"
                                    aria-expanded
                                    title={t('foldMonths')}
                                    onClick={() =>
                                        column.foldKey &&
                                        toggleFold(column.foldKey)
                                    }
                                    className={cn(
                                        headerButton,
                                        'text-muted-foreground',
                                    )}
                                >
                                    <ChevronLeft
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                    {monthLabel(column.key)}
                                </button>
                            ) : monthsWithLogins.has(column.key) ? (
                                <button
                                    type="button"
                                    aria-expanded={expanded.has(column.key)}
                                    aria-label={t('toggleDays', {
                                        month: monthLabel(column.key),
                                    })}
                                    onClick={() => toggle(column.key)}
                                    className={headerButton}
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
                    <TableHead className="bg-card sticky right-0 z-10 pr-4 pl-3 text-right">
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
                                // A folded run has no logins by definition.
                                const count =
                                    column.kind === 'folded'
                                        ? 0
                                        : counts.get(column.key);
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
                            <TableCell className="bg-card sticky right-0 pr-4 pl-3 text-right font-medium tabular-nums">
                                {user.logins}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
            <TableFooter className="[&_td]:bg-card sticky -bottom-px z-10 font-semibold [&_td]:shadow-[inset_0_1px_0_var(--border)]">
                <TableRow>
                    <TableCell className="bg-card sticky left-0">
                        {t('total')}
                    </TableCell>
                    {columns.map(column => {
                        const total =
                            column.kind === 'folded'
                                ? 0
                                : (columnTotals.get(column.key) ?? 0);
                        return (
                            <TableCell
                                key={column.key}
                                className={cn(
                                    'px-1.5 text-center tabular-nums',
                                    !total && 'text-muted-foreground/40',
                                    dayTint(column),
                                )}
                            >
                                {formatter.number(total)}
                            </TableCell>
                        );
                    })}
                    <TableCell className="bg-card sticky right-0 pr-4 pl-3 text-right tabular-nums">
                        {formatter.number(
                            users.reduce((sum, user) => sum + user.logins, 0),
                        )}
                    </TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    );
}
