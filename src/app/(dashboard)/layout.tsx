import { withViewer } from '@/lib/auth-session/with-viewer';
import { ok } from '@/lib/result/result';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const access = await withViewer(async () => ok(null));

    if (!access.ok) {
        if (access.error.kind === 'unauthorized') redirect('/api/auth/logout');
        if (access.error.kind === 'forbidden') redirect('/no-access');

        const t = await getTranslations('Auth');
        return (
            <main role="alert" className="p-6">
                {t('accessCheckError')}
            </main>
        );
    }

    return children;
}
