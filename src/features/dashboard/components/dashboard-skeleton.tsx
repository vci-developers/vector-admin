import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Mirrors the loaded page (toolbar, map beside its panel, summary tiles) so
 * nothing jumps when the data arrives. The message is for screen readers; the
 * shapes already say "loading" to everyone else.
 */
export default function DashboardSkeleton({ message }: { message: string }) {
    return (
        <div className="flex flex-col gap-8" aria-busy="true">
            <p role="status" className="sr-only">
                {message}
            </p>
            {/* Same box as the real toolbar: Program filter, then the period. */}
            <div className="-mx-4 flex items-center gap-2 border-b px-4 py-3 sm:-mx-6 sm:px-6">
                <Skeleton height="lg" width="md" rounded="md" />
                <Skeleton height="lg" width="xl" rounded="md" />
            </div>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton height="md" width="lg" />
                    <Skeleton height="sm" width="xl" />
                </div>
                <div className="grid gap-4 lg:grid-cols-4">
                    <Card className="h-[34rem] p-0 lg:col-span-3">
                        {/* Faded: a map-sized block at full strength is louder than the page. */}
                        <Skeleton
                            className="h-full w-full opacity-50"
                            rounded="lg"
                        />
                    </Card>
                    <Card className="gap-3 p-4 lg:h-[34rem]">
                        <Skeleton height="md" width="md" />
                        <Skeleton height="lg" width="full" rounded="md" />
                        <Skeleton className="mx-auto my-4 size-40 rounded-full" />
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} height="sm" width="full" />
                        ))}
                    </Card>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                    <Card key={index} className="gap-2 px-4 py-3">
                        <Skeleton height="xs" width="sm" />
                        <Skeleton height="lg" width="md" />
                    </Card>
                ))}
            </div>
        </div>
    );
}
