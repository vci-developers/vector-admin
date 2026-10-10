import VectorCamLogo from '@/components/ui/vectorcam-logo';
import type { ViewAs } from '@/lib/auth-session/viewer';
import { getTranslations } from 'next-intl/server';
import ThemeToggle from './theme-toggle';
import ViewAsToggle from './view-as-toggle';

export default async function AppHeader({
    viewAs,
}: {
    /** The header switch's choice; null for anyone but a Developer. */
    viewAs: ViewAs | null;
}) {
    const t = await getTranslations('App');
    return (
        <header className="bg-card border-border/70 border-b">
            <div className="mx-auto flex min-h-[72px] max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-10">
                <div className="flex items-center gap-3">
                    <VectorCamLogo className="h-9" />
                    <p className="flex flex-col text-lg leading-tight font-semibold tracking-tight">
                        {t('title')}
                        <span className="text-muted-foreground mt-1 text-[11px] font-normal tracking-normal">
                            {t('tagline')}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    {viewAs && <ViewAsToggle current={viewAs} />}
                    <div className="text-muted-foreground opacity-75 transition-opacity focus-within:opacity-100 hover:opacity-100">
                        <ThemeToggle />
                    </div>
                    {/* Plain anchor: the logout route handler must run, not a client transition */}
                    <a
                        href="/api/auth/logout"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md px-1 py-2 text-xs transition-colors outline-none focus-visible:ring-2"
                    >
                        {t('signOut')}
                    </a>
                </div>
            </div>
        </header>
    );
}
