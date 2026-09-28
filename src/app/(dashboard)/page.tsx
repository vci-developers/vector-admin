import AppHeader from '@/features/dashboard/components/app-header';
import DashboardView from '@/features/dashboard/components/dashboard-view';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function DashboardPage() {
    const t = await getTranslations('Dashboard');
    return (
        <>
            <AppHeader />
            <main className="mx-auto flex w-full max-w-screen-2xl flex-col px-4 pb-10 sm:px-6">
                <h1 className="sr-only">{t('heading')}</h1>
                <Suspense>
                    <DashboardView />
                </Suspense>
            </main>
        </>
    );
}
