import { describe, expect, it } from 'vitest';
import {
    previousMapView,
    pushMapView,
    sameMapView,
    type MapView,
} from './map-view-trail';

const world: MapView = {
    country: null,
    districtKey: null,
    stephensi: false,
    exclude: null,
};
const stephensi: MapView = { ...world, stephensi: true };
const uganda: MapView = { ...stephensi, country: 'Uganda' };

describe('sameMapView', () => {
    it('tells a default selection from an empty exclude list', () => {
        expect(sameMapView(world, { ...world, exclude: [] })).toBe(false);
        expect(
            sameMapView(
                { ...world, exclude: [1, 2] },
                { ...world, exclude: [1, 2] },
            ),
        ).toBe(true);
    });
});

describe('pushMapView', () => {
    it('skips a repeat of the last step', () => {
        expect(pushMapView([world], { ...world })).toEqual([world]);
    });

    it('keeps the last steps only', () => {
        const trail = pushMapView([world, stephensi], uganda, 2);
        expect(trail).toEqual([stephensi, uganda]);
    });
});

describe('previousMapView', () => {
    it('returns the last different step and the trail before it', () => {
        expect(previousMapView([world, stephensi], uganda)).toEqual({
            view: stephensi,
            rest: [world],
        });
    });

    it('skips steps that match the current view', () => {
        expect(previousMapView([world, uganda], uganda)).toEqual({
            view: world,
            rest: [],
        });
    });

    it('has nothing to go back to on an empty or matching trail', () => {
        expect(previousMapView([], world).view).toBeNull();
        expect(previousMapView([world], world)).toEqual({
            view: null,
            rest: [],
        });
    });
});
