import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSkeleton({ message }: { message: string }) {
    return (
        <div className="flex flex-col gap-4" aria-busy="true">
            <p role="status" className="text-muted-foreground text-sm">
                {message}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }, (_, index) => (
                    <Card key={index} className="gap-2 px-4 py-3">
                        <Skeleton height="xs" width="sm" />
                        <Skeleton height="lg" width="md" />
                    </Card>
                ))}
            </div>
            <Card className="gap-3 p-4">
                {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} height="md" width="full" />
                ))}
            </Card>
        </div>
    );
}
