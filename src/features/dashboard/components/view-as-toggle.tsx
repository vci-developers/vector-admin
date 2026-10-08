'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ViewAs } from '@/lib/auth-session/viewer';
import { useTranslations } from 'next-intl';

const COOKIE = 'viewAs';

/**
 * Developers only: switch between the full dashboard and what a Stakeholder
 * sees. The server applies it, so the preview is the real trimmed data.
 */
export default function ViewAsToggle({ current }: { current: ViewAs }) {
    const t = useTranslations('App.viewAs');

    function choose(value: string) {
        if (value !== 'developer' && value !== 'stakeholder') return;
        if (value === current) return;
        document.cookie =
            value === 'stakeholder'
                ? `${COOKIE}=stakeholder; path=/; SameSite=Lax`
                : `${COOKIE}=; path=/; SameSite=Lax; Max-Age=0`;
        // Every query and the server-rendered header change with it.
        window.location.reload();
    }

    return (
        <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={current}
            onValueChange={choose}
            aria-label={t('label')}
        >
            <ToggleGroupItem value="developer" className="px-2.5 text-xs">
                {t('developer')}
            </ToggleGroupItem>
            <ToggleGroupItem value="stakeholder" className="px-2.5 text-xs">
                {t('stakeholder')}
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
