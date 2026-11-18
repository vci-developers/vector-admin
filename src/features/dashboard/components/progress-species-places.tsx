'use client';

import type { SpecimenPlace } from '@/features/dashboard/utils/species-timeline';
import { MapPin } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import GlidingNumber from './gliding-number';
import styles from './progress-view.module.css';

/**
 * Where a species' specimens so far come from, on the timeline with that
 * species chosen: by country, or by area inside one.
 */
export default function ProgressSpeciesPlaces({
    species,
    places,
    byArea,
    color,
}: {
    /** The species, its name already in italics. */
    species: ReactNode;
    places: readonly SpecimenPlace[];
    byArea: boolean;
    /** The species' chart colour, for each row's share bar. */
    color: string;
}) {
    const most = Math.max(1, ...places.map(place => place.specimens));
    return (
        <section
            aria-labelledby="progress-species-places-heading"
            className={styles.areaContributions}
        >
            <div className="flex shrink-0 items-start gap-3">
                <span className={styles.contributionsIcon}>
                    <MapPin className="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h3
                        id="progress-species-places-heading"
                        className="text-sm font-semibold"
                    >
                        Where it was found
                    </h3>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                        {species} specimens by {byArea ? 'area' : 'country'} so
                        far.
                    </p>
                </div>
            </div>
            {places.length > 0 ? (
                <ol className={styles.contributionList}>
                    {places.map(place => (
                        <li key={place.key} className={styles.speciesRow}>
                            <span
                                aria-hidden="true"
                                className={styles.speciesBar}
                                data-shown="true"
                                style={
                                    {
                                        '--share': place.specimens / most,
                                        background: `color-mix(in srgb, ${color} 22%, transparent)`,
                                    } as CSSProperties
                                }
                            />
                            <div className="flex items-center justify-between gap-3">
                                {/* The breakdown's row style, so the bars match. */}
                                <p className={styles.contributionArea}>
                                    {place.name}
                                </p>
                                <span className={styles.contributionCount}>
                                    <GlidingNumber value={place.specimens} />
                                    <span className="text-muted-foreground ml-1 font-normal">
                                        {place.specimens === 1
                                            ? 'specimen'
                                            : 'specimens'}
                                    </span>
                                </span>
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                    None found yet.
                </p>
            )}
        </section>
    );
}
