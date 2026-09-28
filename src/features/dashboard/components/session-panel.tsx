'use client';

import { useGetProgramSessions } from '@/api/program-sessions/hooks/use-get-program-sessions';
import type { ProgramSessions } from '@/api/program-sessions/validation/program-sessions-schema';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters';
import type { DisplayPeriod } from '@/features/dashboard/hooks/use-period-label';
import { Clock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

type SessionRow = ProgramSessions['sessions'][number];

const HOUR = 60 * 60 * 1000;

function useFormatDuration() {
    const t = useTranslations('Sessions.duration');
    return (ms: number) => {
        if (ms < HOUR)
            return t('minutes', { count: Math.max(1, Math.round(ms / 60000)) });
        if (ms < 48 * HOUR) return t('hours', { count: Math.round(ms / HOUR) });
        return t('days', { count: Math.round(ms / (24 * HOUR)) });
    };
}

function MissingFields({ session }: { session: SessionRow }) {
    const t = useTranslations('Sessions');
    const tFields = useTranslations('Fields');
    const { missing } = session;
    const labels = [
        missing.species > 0 &&
            t('missingSpecies', {
                count: missing.species,
                total: session.specimenCount,
            }),
        missing.captureDate && tFields('captureDate'),
        missing.geolocation && tFields('geolocation'),
        missing.operatorId && tFields('operatorId'),
    ].filter((label): label is string => Boolean(label));

    if (labels.length === 0) {
        return (
            <span className="text-muted-foreground">{t('noneMissing')}</span>
        );
    }
    return (
        <div className="flex flex-wrap gap-1">
            {labels.map(label => (
                <Badge key={label} variant="outline">
                    {label}
                </Badge>
            ))}
        </div>
    );
}

export default function SessionPanel({
    programNames,
    period,
}: {
    programNames: Map<number, string>;
    period: DisplayPeriod;
}) {
    const t = useTranslations('Sessions');
    const formatter = useFormatter();
    const formatDuration = useFormatDuration();
    const [{ sessions: programId }, setFilters] = useDashboardFilters();
    const query = useGetProgramSessions(programId, {
        from: period.from,
        to: period.to,
    });
    const result = query.data;
    const rows = result?.ok ? result.data.sessions : [];
    const uncertifiedCount = rows.filter(row => !row.isCertified).length;
    const formatDate = (timestamp: number) =>
        formatter.dateTime(timestamp, { dateStyle: 'medium' });

    return (
        <Sheet
            open={programId !== null}
            onOpenChange={open => {
                if (!open) setFilters({ sessions: null });
            }}
        >
            <SheetContent
                closeLabel={t('close')}
                className="w-full gap-0 sm:max-w-4xl"
            >
                <SheetHeader className="border-b">
                    <SheetTitle>
                        {t('title', {
                            program: programNames.get(programId ?? 0) ?? '',
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
                <div className="min-h-0 flex-1 overflow-auto p-2">
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
                        <Table>
                            <TableHeader className="bg-popover sticky top-0">
                                <TableRow>
                                    <TableHead>{t('session')}</TableHead>
                                    <TableHead>{t('state')}</TableHead>
                                    <TableHead>{t('device')}</TableHead>
                                    <TableHead>{t('site')}</TableHead>
                                    <TableHead>{t('collected')}</TableHead>
                                    <TableHead>{t('submitted')}</TableHead>
                                    <TableHead>
                                        {t('timeToConfirmation')}
                                    </TableHead>
                                    <TableHead>{t('missing')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map(row => (
                                    <TableRow
                                        key={row.sessionId}
                                        className={
                                            row.isCertified
                                                ? undefined
                                                : 'bg-warning/10'
                                        }
                                    >
                                        <TableCell className="tabular-nums">
                                            {row.sessionId}
                                        </TableCell>
                                        <TableCell>
                                            {row.isCertified ? (
                                                <Badge variant="outline">
                                                    {t(
                                                        `states.${row.state ?? 'UNKNOWN'}`,
                                                    )}
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="border-warning text-foreground gap-1"
                                                >
                                                    <Clock aria-hidden="true" />
                                                    {t(
                                                        `states.${row.state ?? 'UNKNOWN'}`,
                                                    )}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {row.deviceId}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {row.siteId}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {row.collectionDate === null ? (
                                                <span className="text-muted-foreground">
                                                    {t('noDate')}
                                                </span>
                                            ) : (
                                                formatDate(row.collectionDate)
                                            )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {formatDate(row.submittedAt)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {row.timeToConfirmation === null ? (
                                                <span className="text-muted-foreground">
                                                    {t('notConfirmed')}
                                                </span>
                                            ) : (
                                                formatDuration(
                                                    row.timeToConfirmation,
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <MissingFields session={row} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
