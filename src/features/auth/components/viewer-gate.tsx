import { withViewer } from '@/lib/auth-session/with-viewer';
import { ok } from '@/lib/result/result';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import ReloadButton from './reload-button';

export default async function ViewerGate({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    const access = await withViewer(async () => ok(null));

    if (!access.ok) {
        // Signed out, saying why, so a refused session never just bounces.
        if (access.error.kind === 'unauthorized')
            redirect(
                `/api/auth/logout?reason=${encodeURIComponent(access.error.message ?? '')}`,
            );
        if (access.error.kind === 'forbidden') redirect('/no-access');

        const t = await getTranslations('Auth');
        // A reload retries the check; a plain anchor, as the logout route
        // must run, not a client transition.
        return (
            <main className="flex flex-col items-start gap-3 p-6">
                <p role="alert">{t('accessCheckError')}</p>
                <div className="flex gap-4 text-sm font-medium">
                    <ReloadButton label={t('tryAgain')} />
                    <a href="/api/auth/logout" className="underline">
                        {t('signOut')}
                    </a>
                </div>
            </main>
        );
    }

    return children;
}
