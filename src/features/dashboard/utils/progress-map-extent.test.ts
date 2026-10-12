import { describe, expect, it } from 'vitest';
import {
    clampProgressMapZoom,
    progressMapExtent,
    progressMapMinimumZoom,
} from './progress-map-extent';

describe('progress map navigation extent', () => {
    it('frames actual country and reporting coordinates with margin without changing inputs', () => {
        const points = [
            { latitude: -1.5, longitude: 29.5 },
            { latitude: 4.5, longitude: 35 },
            { latitude: 3.5, longitude: 31 },
        ];
        const before = structuredClone(points);
        const extent = progressMapExtent(points)!;

        expect(extent.south).toBeCloseTo(-2.7);
        expect(extent.north).toBeCloseTo(5.7);
        expect(extent.west).toBeCloseTo(28.4);
        expect(extent.east).toBeCloseTo(36.1);
        for (const point of points) {
            expect(point.latitude).toBeGreaterThan(extent.south);
            expect(point.latitude).toBeLessThan(extent.north);
            expect(point.longitude).toBeGreaterThan(extent.west);
            expect(point.longitude).toBeLessThan(extent.east);
        }
        expect(points).toEqual(before);
        expect(progressMapExtent(points.toReversed())).toEqual(extent);
    });

    it('gives a singleton point a finite pan region and allows country overview', () => {
        const extent = progressMapExtent([{ latitude: 1.5, longitude: 32.3 }])!;

        expect(extent.south).toBe(0.5);
        expect(extent.north).toBe(2.5);
        expect(extent.west).toBeCloseTo(31.3);
        expect(extent.east).toBeCloseTo(33.3);
        expect(
            progressMapMinimumZoom(extent, { width: 1000, height: 620 }),
        ).toBe(5.5);
    });

    it('lowers the zoom floor for a phone and a wider multi-country footprint', () => {
        const uganda = progressMapExtent([
            { latitude: -1.5, longitude: 29.5 },
            { latitude: 4.5, longitude: 35 },
        ])!;
        const international = progressMapExtent([
            { latitude: -4, longitude: -79 },
            { latitude: 13, longitude: 42 },
        ])!;
        const desktop = { width: 1000, height: 620 };
        const phone = { width: 360, height: 440 };
        const ugandaFloor = progressMapMinimumZoom(uganda, desktop);
        const internationalFloor = progressMapMinimumZoom(
            international,
            desktop,
        );
        const phoneFloor = progressMapMinimumZoom(international, phone);

        expect(internationalFloor).toBeLessThan(ugandaFloor);
        expect(phoneFloor).toBeLessThan(internationalFloor);
        expect(phoneFloor).toBeGreaterThanOrEqual(1);
        expect(ugandaFloor).toBeLessThan(6);
        expect(Number.isInteger(phoneFloor * 4)).toBe(true);
    });

    it('clamps world edges below Mercator poles and excludes invalid coordinates', () => {
        const extent = progressMapExtent([
            { latitude: 90, longitude: 180 },
            { latitude: -90, longitude: -180 },
            { latitude: 100, longitude: 0 },
            { latitude: 0, longitude: Number.NaN },
        ])!;

        expect(extent.west).toBe(-180);
        expect(extent.east).toBe(180);
        expect(extent.north).toBeCloseTo(85.0511287798066);
        expect(extent.south).toBeCloseTo(-85.0511287798066);
        expect(
            Number.isFinite(
                progressMapMinimumZoom(extent, { width: 360, height: 440 }),
            ),
        ).toBe(true);
        expect(
            progressMapExtent([{ latitude: Infinity, longitude: 0 }]),
        ).toBeNull();
        expect(progressMapExtent([])).toBeNull();
        const polarPoint = progressMapExtent([
            { latitude: 90, longitude: 180 },
        ])!;
        expect(polarPoint.north).toBeGreaterThan(polarPoint.south);
        expect(
            Number.isFinite(
                progressMapMinimumZoom(polarPoint, { width: 360, height: 440 }),
            ),
        ).toBe(true);
    });

    it('handles temporarily empty layouts without an invalid zoom limit', () => {
        const extent = progressMapExtent([{ latitude: 0, longitude: 0 }])!;

        expect(progressMapMinimumZoom(extent, { width: 0, height: 440 })).toBe(
            1,
        );
        expect(progressMapMinimumZoom(extent, { width: 360, height: 0 })).toBe(
            1,
        );
    });

    it('keeps accumulated pinch zoom within both limits, including extreme deltas', () => {
        expect(clampProgressMapZoom(9.125, 5.5)).toBe(9.125);
        expect(clampProgressMapZoom(9 - 100, 5.5)).toBe(5.5);
        expect(clampProgressMapZoom(9 + 100, 5.5)).toBe(12);
        expect(clampProgressMapZoom(Infinity, 1.25)).toBe(12);
        expect(clampProgressMapZoom(-Infinity, 1.25)).toBe(1.25);
        expect(clampProgressMapZoom(Number.NaN, 1.25)).toBe(1.25);
    });
});
