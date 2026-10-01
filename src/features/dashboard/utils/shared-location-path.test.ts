import { describe, expect, it } from 'vitest';
import { sharedLocationPath } from './shared-location-path';

const path = (...names: string[]) =>
    names.map((name, index) => ({
        level: ['District', 'Sub-county', 'Village'][index],
        name,
    }));

describe('sharedLocationPath', () => {
    it('keeps the whole path of a single point', () => {
        expect(sharedLocationPath([path('Gulu', 'Bobi', 'Aleu')])).toEqual(
            path('Gulu', 'Bobi', 'Aleu'),
        );
    });

    it('keeps only the levels every path shares', () => {
        expect(
            sharedLocationPath([
                path('Gulu', 'Bobi', 'Aleu'),
                path('Gulu', 'Bobi', 'Labwor'),
                path('Gulu', 'Bobi'),
            ]),
        ).toEqual(path('Gulu', 'Bobi'));
    });

    it('is empty when paths split at the top or one is unknown', () => {
        expect(
            sharedLocationPath([path('Gulu', 'Bobi'), path('Lira', 'Bobi')]),
        ).toEqual([]);
        expect(sharedLocationPath([path('Gulu'), []])).toEqual([]);
        expect(sharedLocationPath([])).toEqual([]);
    });

    it('treats the same name at a different level as a different place', () => {
        expect(
            sharedLocationPath([
                [{ level: 'District', name: 'Gulu' }],
                [{ level: 'Region', name: 'Gulu' }],
            ]),
        ).toEqual([]);
    });
});
