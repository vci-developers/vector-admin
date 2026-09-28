import '@/app/globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('App');
    return { title: t('title'), description: t('description') };
}

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="flex min-h-full flex-col">
                <NextIntlClientProvider>
                    <NuqsAdapter>
                        <QueryProvider>{children}</QueryProvider>
                    </NuqsAdapter>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
