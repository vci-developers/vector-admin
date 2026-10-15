'use client';

import {
    progressAreaBoundaries,
    type ProgressAreaBoundary,
} from '@/features/dashboard/utils/match-progress-district-boundaries';
import { multiPolygonSchema } from '@/features/dashboard/utils/match-coverage-boundaries';
import { useEffect, useState } from 'react';

// The Stakeholder map's boundary files (progress-map.tsx), loaded per country
// on demand; a failed file leaves that country unshaded.
const LOADERS: Record<string, () => Promise<ProgressAreaBoundary[]>> = {
    Uganda: () =>
        import('@/features/dashboard/data/progress-geography.json').then(
            ({ default: geography }) =>
                geography.districts.features.map(feature => ({
                    name: feature.properties.name,
                    geometry: multiPolygonSchema.parse(feature.geometry),
                })),
        ),
    Ghana: () =>
        import('@/features/dashboard/data/progress-areas-ghana.json').then(
            ({ default: file }) => progressAreaBoundaries(file),
        ),
    Kenya: () =>
        import('@/features/dashboard/data/progress-areas-kenya.json').then(
            ({ default: file }) => progressAreaBoundaries(file),
        ),
    Colombia: () =>
        import('@/features/dashboard/data/progress-areas-colombia.json').then(
            ({ default: file }) => progressAreaBoundaries(file),
        ),
    Cameroon: () =>
        import('@/features/dashboard/data/progress-areas-cameroon.json').then(
            ({ default: file }) => progressAreaBoundaries(file),
        ),
};

const cache = new Map<string, ProgressAreaBoundary[]>();

/** Area boundaries for the given countries, filled in as each file loads. */
export function useAreaBoundaries(
    countries: readonly string[],
): ReadonlyMap<string, readonly ProgressAreaBoundary[]> {
    const [loaded, setLoaded] = useState(() => new Map(cache));
    const key = [...new Set(countries)].toSorted().join('|');
    useEffect(() => {
        let current = true;
        const missing = key
            .split('|')
            .filter(country => LOADERS[country] && !cache.has(country));
        void Promise.all(
            missing.map(country =>
                LOADERS[country]()
                    .catch(() => [])
                    .then(boundaries => cache.set(country, boundaries)),
            ),
        ).then(() => {
            if (current && missing.length > 0) setLoaded(new Map(cache));
        });
        return () => {
            current = false;
        };
    }, [key]);
    return loaded;
}
