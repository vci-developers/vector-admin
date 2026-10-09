'use client';

import { loginRouteResponseSchema } from '@/api/auth/validation/login-schema';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
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
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect');
    // Why the last session was ended, when the app signed you out.
    const signedOutReason = searchParams.get('reason');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginError, setLoginError] = useState(false);
    // VectorCam's or VectorAdmin's own reason, when the answer gives one.
    const [loginReason, setLoginReason] = useState<string | null>(null);

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setIsSubmitting(true);
        setLoginError(false);
        setLoginReason(null);

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: formData.get('email'),
                password: formData.get('password'),
            }),
        }).catch(() => null);

        if (!response?.ok) {
            const body = loginRouteResponseSchema.safeParse(
                await response?.json().catch(() => null),
            );
            setIsSubmitting(false);
            setLoginError(true);
            setLoginReason(
                body.success && !body.data.ok
                    ? (body.data.error.message ?? null)
                    : null,
            );
            return;
        }

        // A full page load, not an in-app transition: the browser shows it
        // loading, and the access check's answer (or its error) always lands.
        window.location.assign(safeRedirectPath(redirect));
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
            {signedOutReason && !loginError && (
                <p role="alert" className="text-sm text-red-600">
                    {t('signedOut', { reason: signedOutReason })}
                </p>
            )}
            {loginError && (
                <p role="alert" className="text-sm text-red-600">
                    {loginReason
                        ? t('loginErrorReason', { reason: loginReason })
                        : t('loginError')}
                </p>
            )}
            <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
            >
                {isSubmitting ? t('signingIn') : t('loginButton')}
            </button>
        </form>
    );
}
