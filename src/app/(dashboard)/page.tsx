import { getDefaultExcludedPrograms } from '@/api/dashboard/get-default-excluded-programs';
import AppHeader from '@/features/dashboard/components/app-header';
import DashboardProvider from '@/features/dashboard/components/dashboard-provider';
import DashboardView from '@/features/dashboard/components/dashboard-view';
import { getViewAs } from '@/lib/auth-session/with-viewer';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function DashboardPage() {
    const t = await getTranslations('Dashboard');
    const [viewAs, defaultExclude] = await Promise.all([
        // null for anyone but a Developer: only they can preview.
        getViewAs(),
        getDefaultExcludedPrograms(),
    ]);
    return (
        // A column the height of the window, so the Stakeholder map can take
        // whatever the header, toolbar and tiles leave.
        <div className="flex min-h-dvh flex-col">
            <AppHeader viewAs={viewAs} />
            <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 pb-6 sm:px-6">
                <h1 className="sr-only">{t('heading')}</h1>
                <Suspense>
                    {/* Anyone who isn't a Developer is a Stakeholder here;
                        the data routes forbid everyone else. */}
                    <DashboardProvider
                        view={viewAs ?? 'stakeholder'}
                        defaultExclude={defaultExclude}
                    >
                        <DashboardView view={viewAs ?? 'stakeholder'} />
                    </DashboardProvider>
                </Suspense>
            </main>
        </div>
    );
}
