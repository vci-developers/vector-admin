import ViewerGate from '@/features/auth/components/viewer-gate';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function DashboardLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const t = await getTranslations('Auth');

    return (
        <Suspense
            fallback={
                <p role="status" className="p-6 text-neutral-500">
                    {t('checkingAccess')}
                </p>
            }
        >
            <ViewerGate>{children}</ViewerGate>
        </Suspense>
    );
}
