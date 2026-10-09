'use client';

import { countSentinelSites } from '@/features/dashboard/utils/count-sentinel-sites';
import type { LocationLevel } from '@/features/dashboard/utils/site-location-path';
import { sharedLocationPath } from '@/features/dashboard/utils/shared-location-path';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use } from 'react';
import { ViewContext } from './dashboard-provider';

type Located = { siteId: number | null; location: LocationLevel[] };

/**
 * Where something is, broadest place first ("Gulu › Bobi › Aleu"). For a
 * group, only the places all of it shares, plus how many Sentinel Sites (and
 * houses, where Sites are houses) it spans, so the path gets more specific as
 * clusters split on zooming in.
 */
export default function LocationPath({
    items,
    showCounts = true,
}: {
    items: Located[];
    /** false where the counts are shown elsewhere, framed as the tiles. */
    showCounts?: boolean;
}) {
    const t = useTranslations('MapSection');
    const view = use(ViewContext);
    if (items.length === 0) return null;

    // Stakeholders see a place only to its District (or the first level).
    const shared = sharedLocationPath(items.map(item => item.location));
    const path = view === 'stakeholder' ? shared.slice(0, 1) : shared;
    const { sentinelSites, houses } = showCounts
        ? countSentinelSites(items)
        : { sentinelSites: 0, houses: 0 };
    // The path already names a single site or house; counts start at two.
    const counts = [
        sentinelSites > 1 &&
            t('locationSentinelSites', { count: sentinelSites }),
        houses > 1 && t('locationHouses', { count: houses }),
    ].filter(Boolean);
    const spansSites = counts.length > 0;
    // Without counts, places with nothing in common (the whole map, a
    // cluster across Districts) are not unknown: the line is just left out.
    if (path.length === 0 && !showCounts && items.length > 1) return null;
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
                        {counts.join(' · ')}
                    </span>
                )}
            </span>
        </p>
    );
}
