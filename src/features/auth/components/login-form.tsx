'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

function safeRedirectPath(redirect: string | null): string {
    return redirect?.startsWith('/') &&
        !redirect.startsWith('//') &&
        !redirect.includes('\\')
        ? redirect
        : '/';
}

export default function LoginForm() {
    const t = useTranslations('Auth');
    const router = useRouter();
    const redirect = useSearchParams().get('redirect');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginError, setLoginError] = useState(false);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setIsSubmitting(true);
        setLoginError(false);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
            }),
        }).catch(() => null);

        if (!response?.ok) {
            setIsSubmitting(false);
            setLoginError(true);
            return;
        }

        router.replace(safeRedirectPath(redirect));
        router.refresh();
    }

    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
                {t('email')}
                <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-invalid={loginError}
                    className="rounded-md border px-3 py-2 font-normal"
                />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
                {t('password')}
                <input
                    name="password"
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                    aria-invalid={loginError}
                    className="rounded-md border px-3 py-2 font-normal"
                />
            </label>
            {loginError && (
                <p role="alert" className="text-sm text-red-600">
                    {t('loginError')}
                </p>
            )}
            <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
                {t('loginButton')}
            </button>
        </form>
    );
}
