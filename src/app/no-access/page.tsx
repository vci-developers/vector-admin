import { getTranslations } from 'next-intl/server';

export default async function NoAccessPage() {
    const t = await getTranslations('NoAccess');

    return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
                {t('description')}
            </p>
            {/* Plain anchor: the logout route handler must run, not a client transition */}
            <a
                href="/api/auth/logout"
                className="text-sm font-medium underline"
            >
                {t('switchAccount')}
            </a>
        </main>
    );
}
