import { Skeleton } from '@/components/ui/skeleton';
import VectorCamLogo from '@/components/ui/vectorcam-logo';
import ProgressLoading from './progress-loading';
import styles from './progress-view.module.css';

/** Public placeholders only: rendering this shell never reads the session. */
export default function DashboardLoading() {
    return (
        <div className="flex min-h-dvh flex-col" aria-busy="true">
            <header className="bg-card border-border/70 border-b">
                <div className="mx-auto flex min-h-[72px] max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
                    <VectorCamLogo className="h-9" />
                    <p className="flex flex-col text-lg leading-tight font-semibold tracking-tight">
                        VectorCam
                        <span className="text-muted-foreground mt-1 text-[11px] font-normal tracking-normal">
                            Surveillance progress
                        </span>
                    </p>
                </div>
            </header>
            <main className="flex w-full flex-1 flex-col px-4 pb-8 sm:px-6 lg:px-10">
                <div className={`${styles.dashboard} space-y-5 sm:space-y-6`}>
                    <div
                        aria-hidden="true"
                        className="flex flex-wrap items-end justify-between gap-6"
                    >
                        <div className="space-y-3">
                            <Skeleton width="lg" height="xs" />
                            <Skeleton
                                width="xl"
                                height="lg"
                                className="max-w-full"
                            />
                            <Skeleton width="xl" height="sm" />
                        </div>
                        <Skeleton
                            width="xl"
                            className="h-[90px] max-w-full rounded-xl sm:w-[440px]"
                        />
                    </div>
                    <ProgressLoading message="Loading your dashboard…" />
                </div>
            </main>
        </div>
    );
}
