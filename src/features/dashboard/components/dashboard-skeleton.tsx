import { Card } from '@/components/ui/card';
import { cn } from '@/utils/cn';
import { SUMMARY_ROW } from './kpi-tiles';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReactNode } from 'react';

/**
 * Mirrors the loaded page (toolbar, map beside its panel, summary tiles) so
 * nothing jumps when the data arrives. The message is for screen readers; the
 * shapes already say "loading" to everyone else. Coverage loads in about a
 * second, so its map and cards stand in for their blocks once they arrive.
 */
export default function DashboardSkeleton({
    message,
    map,
    coverageCards,
    activityCards,
    coverageCardsFirst,
}: {
    message: string;
    map?: ReactNode;
    coverageCards?: ReactNode;
    /** Placeholders for the 8 activity cards: only for viewers who get them. */
    activityCards: boolean;
    /**
     * Stakeholders: the summary (three headline tiles, then the coverage
     * cards, given as grid cells) above a map with no heading, filling the
     * window.
     */
    coverageCardsFirst: boolean;
}) {
    return (
        <div
            className={cn(
                'flex flex-col',
                coverageCardsFirst ? 'gap-4 lg:flex-1' : 'gap-8',
            )}
            aria-busy="true"
        >
            <p role="status" className="sr-only">
                {message}
            </p>
            {/* Same box as the real toolbar: Program filter, then the period. */}
            <div className="-mx-4 flex items-center gap-2 border-b px-4 py-3 sm:-mx-6 sm:px-6">
                <Skeleton height="lg" width="md" rounded="md" />
                <Skeleton height="lg" width="xl" rounded="md" />
            </div>
            {coverageCardsFirst && (
                // The three headline tiles, then the coverage tiles; no
                // heading, as on the loaded page.
                <div className="flex flex-col gap-4">
                    <div className={SUMMARY_ROW}>
                        {Array.from({ length: 3 }, (_, index) => (
                            <Card key={index} className="gap-2 px-4 py-3">
                                <Skeleton height="xs" width="sm" />
                                <Skeleton height="lg" width="md" />
                            </Card>
                        ))}
                        {coverageCards}
                    </div>
                </div>
            )}
            <div
                className={cn(
                    'flex flex-col gap-4',
                    coverageCardsFirst && 'lg:flex-1',
                )}
            >
                {/* Stakeholders' map has no heading. */}
                {!coverageCardsFirst && (
                    <div className="flex flex-col gap-2">
                        <Skeleton height="md" width="lg" />
                        <Skeleton height="sm" width="xl" />
                    </div>
                )}
                <div
                    className={cn(
                        'grid gap-4 lg:grid-cols-4',
                        coverageCardsFirst &&
                            'lg:flex-1 lg:grid-rows-[minmax(24rem,1fr)]',
                    )}
                >
                    <Card
                        className={cn(
                            'relative isolate h-[34rem] overflow-hidden p-0 lg:col-span-3',
                            coverageCardsFirst && 'lg:h-auto',
                        )}
                    >
                        {map ?? (
                            // Faded: a map-sized block at full strength is louder than the page.
                            <Skeleton
                                className="h-full w-full opacity-50"
                                rounded="lg"
                            />
                        )}
                    </Card>
                    <Card
                        className={cn(
                            'gap-3 p-4 lg:h-[34rem]',
                            coverageCardsFirst &&
                                'lg:h-auto lg:min-h-0 lg:overflow-hidden',
                        )}
                    >
                        <Skeleton height="md" width="md" />
                        <Skeleton height="lg" width="full" rounded="md" />
                        <Skeleton className="mx-auto my-4 size-40 rounded-full" />
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} height="sm" width="full" />
                        ))}
                    </Card>
                </div>
            </div>
            {activityCards && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {Array.from({ length: 8 }, (_, index) => (
                        <Card key={index} className="gap-2 px-4 py-3">
                            <Skeleton height="xs" width="sm" />
                            <Skeleton height="lg" width="md" />
                        </Card>
                    ))}
                </div>
            )}
            {!coverageCardsFirst && coverageCards}
        </div>
    );
}
