import { describe, expect, it } from 'vitest';
import { buildHexShading } from './build-hex-shading';

const session = (
    sessionId: number,
    latitude: number,
    longitude: number,
    specimenCount: number,
    places: string[],
    programId = 1,
) => ({
    sessionId,
    programId,
    latitude,
    longitude,
    specimenCount,
    location: places.map(name => ({ level: 'Level', name })),
});

describe('buildHexShading', () => {
    it('bins nearby Sessions into one cell named for their shared places', () => {
        const cells = buildHexShading([
            session(1, 2.7746, 32.2989, 3, ['Gulu', 'Bobi', 'Aleu']),
            session(2, 2.7751, 32.2995, 4, ['Gulu', 'Bobi', 'Ongako']),
            session(3, 0.3476, 32.5825, 1, ['Kampala']),
        ]);
        expect(cells).toHaveLength(2);
        const gulu = cells.find(cell => cell.name === 'Bobi');
        expect(gulu).toMatchObject({ specimens: 7, sessionIds: [1, 2] });
        // Closed ring of six corners around the Sessions.
        const ring = gulu!.geometry.coordinates[0][0];
        expect(ring).toHaveLength(7);
        expect(ring[6]).toEqual(ring[0]);
        const lngs = ring.map(([lng]) => lng);
        const lats = ring.map(([, lat]) => lat);
        expect(Math.min(...lngs)).toBeLessThan(32.2989);
        expect(Math.max(...lngs)).toBeGreaterThan(32.2995);
        expect(Math.min(...lats)).toBeLessThan(2.7746);
        expect(Math.max(...lats)).toBeGreaterThan(2.7751);
    });

    it('keeps Programs apart and never gives two cells one name', () => {
        const cells = buildHexShading([
            session(1, 2.7746, 32.2989, 1, ['Gulu'], 1),
            session(2, 2.7746, 32.2989, 1, ['Gulu'], 2),
            session(3, 3.5, 32.2989, 1, ['Gulu'], 1),
        ]);
        expect(cells.map(cell => [cell.programId, cell.name])).toEqual([
            [1, 'Gulu'],
            [2, 'Gulu'],
            [1, 'Gulu (2)'],
        ]);
    });
});
