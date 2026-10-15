'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    DENSITIES,
    DENSITY_COOKIE,
    type Density,
} from '@/features/dashboard/utils/density';
import { Rows2, Rows3, Rows4 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const ICONS = { compact: Rows4, comfortable: Rows3, spacious: Rows2 };

/** Developers only: card spacing on the internal page, saved per browser. */
export default function DensityToggle({ initial }: { initial: Density }) {
    const t = useTranslations('App.density');
    const [density, setDensity] = useState(initial);

    function choose(value: string) {
        const next = DENSITIES.find(choice => choice === value);
        if (!next) return;
        document.cookie = `${DENSITY_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
        // The server reads the cookie on the next load; this applies it now.
        const main = document.querySelector<HTMLElement>('main[data-density]');
        if (main) main.dataset.density = next;
        setDensity(next);
    }

    return (
        <ToggleGroup
            type="single"
            size="sm"
            value={density}
            onValueChange={choose}
            aria-label={t('label')}
        >
            {DENSITIES.map(value => {
                const Icon = ICONS[value];
                return (
                    <ToggleGroupItem
                        key={value}
                        value={value}
                        aria-label={t(value)}
                    >
                        <Icon aria-hidden="true" />
                    </ToggleGroupItem>
                );
            })}
        </ToggleGroup>
    );
}
