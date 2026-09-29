import { err, ok } from '@/lib/result/result';
import { describe, expect, it, vi } from 'vitest';
import { createSiteGeocoder, type Point } from './site-geocoder';

const KAMPALA: Point = { latitude: 0.35, longitude: 32.58 };
const AHMEDABAD: Point = { latitude: 23.04, longitude: 72.52 };
const lookup = (key: string, query: string) => ({
    key,
    query,
    country: 'Uganda',
});

describe('createSiteGeocoder', () => {
    it('answers later once the background lookup finishes', async () => {
        const geocoder = createSiteGeocoder({
            search: async () => ok(KAMPALA),
            delayMs: 0,
        });

        expect(
            geocoder.lookup([lookup('a', 'Kampala, Uganda')]).pending,
        ).toEqual(['a']);
        await geocoder.idle();
        expect(
            geocoder.lookup([lookup('a', 'Kampala, Uganda')]).resolved.get('a'),
        ).toEqual(KAMPALA);
    });

    it('rejects out-of-country matches and broadens the query', async () => {
        const search = vi.fn(async (query: string) =>
            ok(query.startsWith('Bukatube') ? AHMEDABAD : KAMPALA),
        );
        const geocoder = createSiteGeocoder({ search, delayMs: 0 });

        geocoder.lookup([lookup('a', 'Bukatube, Mayuge, Uganda')]);
        await geocoder.idle();

        expect(search.mock.calls.map(([query]) => query)).toEqual([
            'Bukatube, Mayuge, Uganda',
            'Mayuge, Uganda',
        ]);
        expect(
            geocoder
                .lookup([lookup('a', 'Bukatube, Mayuge, Uganda')])
                .resolved.get('a'),
        ).toEqual(KAMPALA);
    });

    it('records no location when nothing below country level matches', async () => {
        const search = vi.fn(async () => ok(null));
        const geocoder = createSiteGeocoder({ search, delayMs: 0 });

        geocoder.lookup([lookup('a', 'Nowhere, Uganda')]);
        await geocoder.idle();

        expect(search).toHaveBeenCalledTimes(1);
        const { resolved, pending } = geocoder.lookup([
            lookup('a', 'Nowhere, Uganda'),
        ]);
        expect([resolved.get('a'), pending]).toEqual([null, []]);
    });

    it('retries a lookup that errored instead of caching the failure', async () => {
        const search = vi
            .fn()
            .mockResolvedValueOnce(err({ kind: 'network' as const }))
            .mockResolvedValue(ok(KAMPALA));
        const geocoder = createSiteGeocoder({ search, delayMs: 0 });

        geocoder.lookup([lookup('a', 'Kampala, Uganda')]);
        await geocoder.idle();
        expect(
            geocoder.lookup([lookup('a', 'Kampala, Uganda')]).pending,
        ).toEqual(['a']);
        await geocoder.idle();
        expect(
            geocoder.lookup([lookup('a', 'Kampala, Uganda')]).resolved.get('a'),
        ).toEqual(KAMPALA);
    });
});
