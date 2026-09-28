import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
    const t = await getTranslations('Dashboard');
    return (
        <main className="p-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        </main>
    );
}
