import { getViewAs } from '@/lib/auth-session/with-viewer';
import { getTranslations } from 'next-intl/server';
import ThemeToggle from './theme-toggle';
import ViewAsToggle from './view-as-toggle';

export default async function AppHeader() {
    const t = await getTranslations('App');
    // null for anyone but a Developer: only they can preview.
    const viewAs = await getViewAs();
    return (
        <header className="bg-card border-b">
            <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
                <p className="font-semibold tracking-tight">
                    {t('title')}
                    <span className="text-muted-foreground ml-2 text-sm font-normal">
                        {t('tagline')}
                    </span>
                </p>
                <div className="flex items-center gap-4">
                    {viewAs && <ViewAsToggle current={viewAs} />}
                    <ThemeToggle />
                    {/* Plain anchor: the logout route handler must run, not a client transition */}
                    <a
                        href="/api/auth/logout"
                        className="text-muted-foreground hover:text-foreground text-sm"
                    >
                        {t('signOut')}
                    </a>
                </div>
            </div>
        </header>
    );
}
