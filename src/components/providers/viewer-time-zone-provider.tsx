'use client';

import {
    NextIntlClientProvider,
    useLocale,
    useMessages,
    useTimeZone,
} from 'next-intl';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Dates and times show in the viewer's timezone, not the server's (UTC on
// Vercel). Hydration keeps the server's zone so the markup matches, then
// switches.
export function ViewerTimeZoneProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = useLocale();
    const messages = useMessages();
    const serverTimeZone = useTimeZone();
    const timeZone = useSyncExternalStore(
        subscribe,
        browserTimeZone,
        () => serverTimeZone,
    );

    return (
        <NextIntlClientProvider
            locale={locale}
            messages={messages}
            timeZone={timeZone}
        >
            {children}
        </NextIntlClientProvider>
    );
}
