import { describe, expect, it } from 'vitest';
import {
    countVillageDevices,
    plannedVillageDevices,
} from './count-village-devices';

const path = (district: string, village: string, house: string) => [
    { level: 'District', name: district },
    { level: 'Village', name: village },
    { level: 'House', name: house },
];

const sitePaths = {
    1: path('Gulu', 'Payuta', '1'),
    2: path('Gulu', 'Payuta', '2'),
    3: path('Gulu', 'Coopil', '1'),
    4: path('Oyam', 'Agoa', '1'),
    5: path('Oyam', 'England', '1'),
    6: path('Karenga', 'Loputuk', '1'),
};

const byArea = (counts: { area: string; count: number }[]) =>
    Object.fromEntries(counts.map(({ area, count }) => [area, count]));

describe('countVillageDevices', () => {
    it('counts one shared phone per village with data', () => {
        const counts = countVillageDevices(
            [
                { siteId: 1, collectorName: 'Okot Alfred' },
                { siteId: 2, collectorName: 'Akony Denis' },
                { siteId: 3, collectorName: 'Okot Alfred' },
            ],
            sitePaths,
        );

        expect(byArea(counts)).toEqual({ Gulu: 2 });
    });

    it('counts one phone per person in the new Districts, two at most per village', () => {
        const counts = countVillageDevices(
            [
                { siteId: 4, collectorName: 'Acan Fiona Winnie' },
                { siteId: 4, collectorName: 'acan  fiona winnie' },
                { siteId: 5, collectorName: 'Okello Tonny' },
                { siteId: 5, collectorName: 'Apio Helma' },
                {
                    siteId: 6,
                    collectorName: 'Lokwang John and Natyang Gloria',
                },
                { siteId: 6, collectorName: 'Acheng Emmanuella' },
            ],
            sitePaths,
        );

        expect(byArea(counts)).toEqual({ Oyam: 3, Karenga: 2 });
    });

    it('counts a village with only blank names as one device', () => {
        const counts = countVillageDevices(
            [{ siteId: 4, collectorName: ' ' }],
            sitePaths,
        );

        expect(byArea(counts)).toEqual({ Oyam: 1 });
    });
});

describe('plannedVillageDevices', () => {
    it('plans one phone per village, or two in the new Districts', () => {
        expect(plannedVillageDevices('Gulu')).toBe(3);
        expect(plannedVillageDevices('Madi-Okollo')).toBe(6);
    });
});
