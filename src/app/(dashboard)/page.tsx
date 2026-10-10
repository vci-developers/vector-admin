import { getDashboardProgramSelection } from '@/api/dashboard/get-default-excluded-programs';
import AppHeader from '@/features/dashboard/components/app-header';
import DashboardLoading from '@/features/dashboard/components/dashboard-loading';
import DashboardProvider from '@/features/dashboard/components/dashboard-provider';
import DashboardView from '@/features/dashboard/components/dashboard-view';
import ProgressLoading from '@/features/dashboard/components/progress-loading';
import { getViewAs } from '@/lib/auth-session/with-viewer';
import { cn } from '@/utils/cn';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <AuthenticatedDashboard />
        </Suspense>
    );
}

async function AuthenticatedDashboard() {
    const t = await getTranslations('Dashboard');
    const [viewAs, selection] = await Promise.all([
        // null for anyone but a Developer: only they can preview.
        getViewAs(),
        getDashboardProgramSelection(),
    ]);
    return (
        <div className="flex min-h-dvh flex-col">
            <AppHeader viewAs={viewAs} />
            <main
                className={cn(
                    'flex w-full flex-1 flex-col px-4 pb-8 sm:px-6 lg:px-10',
                    viewAs === 'developer' && 'mx-auto max-w-[1600px]',
                )}
            >
                {viewAs === 'developer' && (
                    <h1 className="sr-only">{t('heading')}</h1>
                )}
                <Suspense fallback={<ProgressLoading />}>
                    {/* Anyone who isn't a Developer is a Stakeholder here;
                        the data routes forbid everyone else. */}
                    <DashboardProvider
                        view={viewAs ?? 'stakeholder'}
                        defaultExclude={selection.exclude}
                        programs={selection.programs}
                    >
                        <DashboardView view={viewAs ?? 'stakeholder'} />
                    </DashboardProvider>
                </Suspense>
            </main>
        </div>
    );
}
