import { describe, expect, it } from 'vitest';
import { placeLabels } from './place-labels';

const box = (key: string, x: number, y: number, width = 40) => ({
    key,
    x,
    y,
    width,
    height: 16,
});

describe('placeLabels', () => {
    it('keeps labels that are apart', () => {
        expect(placeLabels([box('a', 0, 0), box('b', 100, 0)])).toEqual(
            new Set(['a', 'b']),
        );
    });

    it('drops a label that would overlap one placed before it', () => {
        expect(
            placeLabels([
                box('big', 0, 0),
                box('small', 20, 5),
                box('far', 0, 60),
            ]),
        ).toEqual(new Set(['big', 'far']));
    });

    it('treats labels that only nearly touch as overlapping', () => {
        // 40 px wide each, centres 42 px apart: 2 px between them, under the gap.
        expect(placeLabels([box('a', 0, 0), box('b', 42, 0)])).toEqual(
            new Set(['a']),
        );
    });

    it('lets labels side by side vertically pass when rows are clear', () => {
        expect(placeLabels([box('a', 0, 0), box('b', 0, 24)])).toEqual(
            new Set(['a', 'b']),
        );
    });
});
