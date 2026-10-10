import colombiaAreas from '@/features/dashboard/data/progress-areas-colombia.json';
import ghanaAreas from '@/features/dashboard/data/progress-areas-ghana.json';
import kenyaAreas from '@/features/dashboard/data/progress-areas-kenya.json';
import cameroonHealthDistricts from '@/features/dashboard/data/progress-areas-cameroon.json';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { progressBoundaryAttribution } from './progress-boundary-attribution';

describe('public boundary credits', () => {
    it.each([colombiaAreas, ghanaAreas, kenyaAreas])(
        'credits geoBoundaries and preserves $country source-specific license and modifications',
        ({ source }) => {
            const credit = progressBoundaryAttribution(source);
            expect(credit).toContain(
                '<a href="https://www.geoboundaries.org/">geoBoundaries</a>',
            );
            expect(credit).toContain(`href="${source.sourceUrl}"`);
            expect(credit).toContain(`href="${source.licenseUrl}"`);
            expect(credit).toContain(`>${source.license}</a>`);
            expect(credit).toContain('simplified');
            expect(credit).toContain(source.provider);
        },
    );

    it('retains accurate UNAIDS source and licensing credit for the Cameroon health-district view', () => {
        const credit = progressBoundaryAttribution(
            cameroonHealthDistricts.source,
        );
        expect(credit).not.toContain('geoBoundaries');
        expect(credit).toContain('UNAIDS');
        expect(credit).toContain('CC BY 3.0 IGO');
    });

    it('offers precisely the adapted Colombia boundary dataset under ODbL without reporting data', async () => {
        const credit = progressBoundaryAttribution(colombiaAreas.source);
        expect(credit).toContain(
            'href="/map-boundaries/colombia.geojson" download',
        );
        const download = JSON.parse(
            await readFile(
                new URL(
                    '../../../../public/map-boundaries/colombia.geojson',
                    import.meta.url,
                ),
                'utf8',
            ),
        );
        expect(download).toEqual(colombiaAreas);
        expect(download.source.license).toBe('ODbL 1.0');
        expect(download.source.licenseUrl).toBe(
            'https://opendatacommons.org/licenses/odbl/1-0/',
        );
        expect(download.source.attribution).toContain(
            'OpenStreetMap contributors',
        );
        for (const feature of download.features)
            expect(Object.keys(feature.properties).sort()).toEqual([
                'aliases',
                'name',
                'sourceId',
            ]);
    });
});
