'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import {
    useGetUserLogins,
    userLoginsSearch,
} from '@/api/user-logins/hooks/use-get-user-logins';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { programSeriesColor } from '@/features/dashboard/utils/series-colors';
import { Download, Loader2, Users as UsersIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import PanelHeader, {
    PANEL_PRIMARY,
    panelClassName,
    SEGMENT,
    SEGMENTED,
} from './panel-header';
import { LoginsBreakdownTable, UsersTable } from './user-login-tables';

type UsersTab = 'users' | 'logins';

export default function UsersSection({
    dashboard,
    period,
}: {
    dashboard: Dashboard;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Users');
    const formatter = useFormatter();
    const [{ exclude }] = useDashboardFilters();
    const params = { exclude, from: period.from, to: period.to };
    const query = useGetUserLogins(params);
    const [download, setDownload] = useState<'idle' | 'busy' | 'failed'>(
        'idle',
    );
    const [tab, setTab] = useState<UsersTab>('users');

    const { programs, programColors } = useMemo(() => {
        const ids = dashboard.programs.map(p => p.programId);
        return {
            programs: new Map(dashboard.programs.map(p => [p.programId, p])),
            programColors: new Map(
                ids.map(id => [id, programSeriesColor(id, ids)]),
            ),
        };
    }, [dashboard.programs]);

    async function downloadReport() {
        setDownload('busy');
        const response = await fetch(
            `/api/user-logins/report?${userLoginsSearch(params)}`,
            {
                credentials: 'include',
            },
        ).catch(() => null);
        if (!response?.ok) {
            setDownload('failed');
            return;
        }
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = `user-logins-${period.from}_${period.to}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        setDownload('idle');
    }

    const result = query.data;
    const users = result?.ok ? result.data.users : [];
    const totalLogins = users.reduce((sum, user) => sum + user.logins, 0);
    const tableProps = { users, period, programs, programColors };

    return (
        <section aria-labelledby="users-heading">
            <Card className={panelClassName}>
                <PanelHeader
                    id="users-heading"
                    icon={UsersIcon}
                    title={t('heading', { period: period.label })}
                    description={
                        result?.ok
                            ? t('summary', {
                                  users: formatter.number(users.length),
                                  logins: formatter.number(totalLogins),
                              })
                            : t('description')
                    }
                    actions={
                        <>
                            {result?.ok && users.length > 0 && (
                                <ToggleGroup
                                    type="single"
                                    size="sm"
                                    spacing={1}
                                    className={SEGMENTED}
                                    value={tab}
                                    onValueChange={value => {
                                        if (value) setTab(value as UsersTab);
                                    }}
                                    aria-label={t('tabsLabel')}
                                >
                                    <ToggleGroupItem
                                        value="users"
                                        className={SEGMENT}
                                    >
                                        {t('usersTitle')}
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="logins"
                                        className={SEGMENT}
                                    >
                                        {t(
                                            period.from === period.to
                                                ? 'byDayTitle'
                                                : 'byMonthTitle',
                                        )}
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            )}
                            {download === 'failed' && (
                                <span
                                    role="alert"
                                    className="text-destructive text-sm"
                                >
                                    {t('downloadFailed')}
                                </span>
                            )}
                            <Button
                                className={PANEL_PRIMARY}
                                onClick={downloadReport}
                                disabled={download === 'busy' || !result?.ok}
                            >
                                {download === 'busy' ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <Download />
                                )}
                                {t('download')}
                            </Button>
                        </>
                    }
                />
                {!result && (
                    <div
                        className="flex flex-col gap-2 p-(--d-pad-x)"
                        aria-busy="true"
                    >
                        {Array.from({ length: 5 }, (_, i) => (
                            <Skeleton key={i} height="md" width="full" />
                        ))}
                    </div>
                )}
                {result && !result.ok && (
                    <p
                        role="alert"
                        className="text-destructive p-(--d-pad-x) text-sm"
                    >
                        {t('loadError')}
                    </p>
                )}
                {result?.ok && users.length === 0 && (
                    <p className="text-muted-foreground p-(--d-pad-x) text-sm">
                        {t('empty')}
                    </p>
                )}
                {result?.ok &&
                    users.length > 0 &&
                    (tab === 'users' ? (
                        <UsersTable {...tableProps} />
                    ) : (
                        <LoginsBreakdownTable {...tableProps} />
                    ))}
            </Card>
        </section>
    );
}
