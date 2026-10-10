'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ViewAs } from '@/lib/auth-session/viewer';
import { useTranslations } from 'next-intl';

const COOKIE = 'viewAs';

/**
 * Developers only: switch between progress and internal dashboards. The
 * server applies the choice and serves the matching data permissions.
 */
export default function ViewAsToggle({ current }: { current: ViewAs }) {
    const t = useTranslations('App.viewAs');

    function choose(value: string) {
        if (value !== 'developer' && value !== 'stakeholder') return;
        if (value === current) return;
        document.cookie = `${COOKIE}=${value}; path=/; SameSite=Lax`;
        // Every query and the server-rendered header change with it.
        window.location.reload();
    }

    return (
        <ToggleGroup
            type="single"
            size="sm"
            spacing={1}
            value={current}
            onValueChange={choose}
            aria-label={t('label')}
            className="bg-muted/70 rounded-full p-1"
        >
            <ToggleGroupItem
                value="stakeholder"
                className="text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground h-7 rounded-full px-3 text-xs data-[state=on]:shadow-sm"
            >
                {t('stakeholder')}
            </ToggleGroupItem>
            <ToggleGroupItem
                value="developer"
                className="text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground h-7 rounded-full px-3 text-xs data-[state=on]:shadow-sm"
            >
                {t('developer')}
            </ToggleGroupItem>
        </ToggleGroup>
    );
}
