import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';
import styles from './progress-view.module.css';

/** A static shell shared by server streaming and the client data loader. */
export default function ProgressLoading({
    message = 'Loading reporting data from VectorCam…',
}: {
    message?: string;
}) {
    return (
        <div role="status" aria-label={message} className="space-y-5">
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {message}
            </p>
            <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:gap-5">
                {[0, 1].map(index => (
                    <div key={index} className="bg-card rounded-2xl border p-6">
                        <Skeleton
                            width="md"
                            height="sm"
                            className="max-w-full"
                        />
                        <Skeleton
                            width="lg"
                            height="xl"
                            className="mt-5 max-w-full"
                        />
                        <Skeleton
                            width="xl"
                            height="xs"
                            className="mt-4 max-w-full"
                        />
                    </div>
                ))}
            </div>
            <div aria-hidden="true" className={styles.visuals}>
                {[0, 1].map(index => (
                    <div key={index} className="bg-card rounded-2xl border p-6">
                        <Skeleton width="lg" height="md" />
                        <Skeleton
                            width="full"
                            className={cn(
                                'mt-6',
                                index === 0 ? styles.mapCanvas : 'h-[400px]',
                            )}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
