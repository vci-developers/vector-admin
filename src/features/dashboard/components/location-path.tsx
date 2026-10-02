'use client';

import type { LocationLevel } from '@/features/dashboard/utils/site-location-path';
import { sharedLocationPath } from '@/features/dashboard/utils/shared-location-path';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Located = { siteId: number | null; location: LocationLevel[] };

/**
 * Where something is, broadest place first ("Gulu › Bobi › Aleu"). For a
 * group, only the places all of it shares, plus how many Sites it spans, so
 * the path gets more specific as clusters split on zooming in.
 */
export default function LocationPath({ items }: { items: Located[] }) {
    const t = useTranslations('MapSection');
    if (items.length === 0) return null;

    const path = sharedLocationPath(items.map(item => item.location));
    const siteCount = new Set(
        items.flatMap(item => (item.siteId === null ? [] : [item.siteId])),
    ).size;
    const spansSites = siteCount > 1;
    if (path.length === 0 && !spansSites) {
        return (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <MapPin className="size-3 shrink-0" aria-hidden="true" />
                {t('locationUnknown')}
            </p>
        );
    }

    return (
        <p className="flex items-start gap-1 text-xs">
            <MapPin
                className="text-muted-foreground mt-0.5 size-3 shrink-0"
                aria-hidden="true"
            />
            <span>
                {path.map(({ level, name }, index) => (
                    <span key={`${level}/${name}`}>
                        {index > 0 && (
                            <span className="text-muted-foreground"> › </span>
                        )}
                        <span title={level}>{name}</span>
                    </span>
                ))}
                {spansSites && (
                    <span className="text-muted-foreground">
                        {path.length > 0 && ' · '}
                        {t('locationSites', { count: siteCount })}
                    </span>
                )}
            </span>
        </p>
    );
}
