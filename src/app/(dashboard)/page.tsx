import AppHeader from '@/features/dashboard/components/app-header';
import DashboardView from '@/features/dashboard/components/dashboard-view';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function DashboardPage() {
    const t = await getTranslations('Dashboard');
    return (
        // A column the height of the window, so the Stakeholder map can take
        // whatever the header, toolbar and tiles leave.
        <div className="flex min-h-dvh flex-col">
            <AppHeader />
            <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 pb-6 sm:px-6">
                <h1 className="sr-only">{t('heading')}</h1>
                <Suspense>
                    <DashboardView />
                </Suspense>
            </main>
        </div>
    );
}
