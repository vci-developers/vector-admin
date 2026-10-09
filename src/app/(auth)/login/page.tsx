import VectorCamLogo from '@/components/ui/vectorcam-logo';
import LoginForm from '@/features/auth/components/login-form';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

export default async function LoginPage() {
    const t = await getTranslations('Auth');

    return (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
            <div>
                <VectorCamLogo className="mb-4 h-12" />
                <h1 className="text-2xl font-semibold">{t('title')}</h1>
                <p className="text-sm text-neutral-500">{t('subtitle')}</p>
            </div>
            <Suspense>
                <LoginForm />
            </Suspense>
        </main>
    );
}
