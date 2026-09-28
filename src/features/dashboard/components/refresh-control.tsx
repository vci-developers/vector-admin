'use client';

import { usePostRefresh } from '@/api/refresh/hooks/use-post-refresh';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { RefreshCw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

type RefreshControlProps = {
    lastUpdatedAt: number | null;
    programIds: number[];
    isRefetching: boolean;
};

export default function RefreshControl({
    lastUpdatedAt,
    programIds,
    isRefetching,
}: RefreshControlProps) {
    const t = useTranslations('Refresh');
    const formatter = useFormatter();
    const refresh = usePostRefresh();
    const isBusy = refresh.isPending || isRefetching;

    return (
        <div className="flex items-center gap-2 text-sm">
            {refresh.data && !refresh.data.ok ? (
                <span role="alert" className="text-destructive">
                    {t('refreshError')}
                </span>
            ) : (
                lastUpdatedAt !== null && (
                    <span className="text-muted-foreground">
                        {t('lastUpdated', {
                            time: formatter.dateTime(lastUpdatedAt, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                            }),
                        })}
                    </span>
                )
            )}
            <Button
                variant="outline"
                size="sm"
                onClick={() => refresh.mutate(programIds)}
                disabled={isBusy || programIds.length === 0}
            >
                <RefreshCw className={cn(isBusy && 'animate-spin')} />
                {isBusy ? t('refreshing') : t('refresh')}
            </Button>
        </div>
    );
}
