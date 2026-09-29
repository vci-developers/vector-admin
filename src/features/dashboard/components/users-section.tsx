'use client';

import type { Dashboard } from '@/api/dashboard/validation/dashboard-schema';
import {
    useGetUserLogins,
    userLoginsSearch,
} from '@/api/user-logins/hooks/use-get-user-logins';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { programSeriesColor } from '@/features/dashboard/utils/series-colors';
import { Download, Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { LoginsBreakdownTable, UsersTable } from './user-login-tables';

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

    const { programNames, programColors } = useMemo(() => {
        const ids = dashboard.programs.map(p => p.programId);
        return {
            programNames: new Map(
                dashboard.programs.map(p => [p.programId, p.name]),
            ),
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
    const tableProps = { users, period, programNames, programColors };

    return (
        <section
            aria-labelledby="users-heading"
            className="flex flex-col gap-4"
        >
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="users-heading" className="text-lg font-semibold">
                        {t('heading', { period: period.label })}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {result?.ok
                            ? t('summary', {
                                  users: formatter.number(users.length),
                                  logins: formatter.number(totalLogins),
                              })
                            : t('description')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {download === 'failed' && (
                        <span role="alert" className="text-destructive text-sm">
                            {t('downloadFailed')}
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
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
                </div>
            </div>

            {!result && (
                <Card className="gap-2 p-4" aria-busy="true">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} height="md" width="full" />
                    ))}
                </Card>
            )}
            {result && !result.ok && (
                <p role="alert" className="text-destructive text-sm">
                    {t('loadError')}
                </p>
            )}
            {result?.ok && users.length === 0 && (
                <p className="text-muted-foreground text-sm">{t('empty')}</p>
            )}
            {result?.ok && users.length > 0 && (
                <div className="flex flex-col gap-4">
                    <Card className="gap-2 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-sm">
                                {t('usersTitle')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-96 overflow-auto px-2">
                            <UsersTable {...tableProps} />
                        </CardContent>
                    </Card>
                    <Card className="gap-2 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-sm">
                                {t(
                                    period.from === period.to
                                        ? 'byDayTitle'
                                        : 'byMonthTitle',
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-96 overflow-auto px-2">
                            <LoginsBreakdownTable {...tableProps} />
                        </CardContent>
                    </Card>
                </div>
            )}
        </section>
    );
}
