'use client';

import type { Program } from '@/api/program/validation/program-schema';
import { useGetProgramSessions } from '@/api/program-sessions/hooks/use-get-program-sessions';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import { programTitle } from '@/features/dashboard/utils/program-title';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { useTranslations } from 'next-intl';
import SessionTable from './session-table';

export default function SessionPanel({
    programs,
    period,
}: {
    programs: Map<number, Program>;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Sessions');
    const [{ sessions: programId }, setFilters] = useDashboardFilters();
    const query = useGetProgramSessions(programId, {
        from: period.from,
        to: period.to,
    });
    const program = programId === null ? undefined : programs.get(programId);
    const result = query.data;
    const rows = result?.ok ? result.data.sessions : [];
    const uncertifiedCount = rows.filter(row => !row.isCertified).length;

    return (
        <Sheet
            open={programId !== null}
            onOpenChange={open => {
                if (!open) setFilters({ sessions: null });
            }}
        >
            <SheetContent
                closeLabel={t('close')}
                // Wide enough for every column without scrolling sideways.
                className="w-full gap-0 sm:max-w-[min(96vw,90rem)]"
            >
                <SheetHeader className="border-b">
                    <SheetTitle>
                        {t('title', {
                            program: program ? programTitle(program) : '',
                            period: period.label,
                        })}
                    </SheetTitle>
                    <SheetDescription>
                        {result?.ok
                            ? t('summary', {
                                  count: rows.length,
                                  uncertified: uncertifiedCount,
                              })
                            : t('description')}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col p-2">
                    {!result && (
                        <div
                            className="flex flex-col gap-2 p-2"
                            aria-busy="true"
                        >
                            {Array.from({ length: 8 }, (_, index) => (
                                <Skeleton
                                    key={index}
                                    height="md"
                                    width="full"
                                />
                            ))}
                        </div>
                    )}
                    {result && !result.ok && (
                        <p
                            role="alert"
                            className="text-destructive p-4 text-sm"
                        >
                            {t('loadError')}
                        </p>
                    )}
                    {result?.ok && rows.length === 0 && (
                        <p className="text-muted-foreground p-4 text-sm">
                            {t('empty')}
                        </p>
                    )}
                    {result?.ok && rows.length > 0 && (
                        <SessionTable key={programId} rows={rows} />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
