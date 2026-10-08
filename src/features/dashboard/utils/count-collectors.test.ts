import { describe, expect, it } from 'vitest';
import { countCollectors } from './count-collectors';

describe('countCollectors', () => {
    it('counts each collector once across their Sessions', () => {
        expect(
            countCollectors([
                { programId: 1, collectorIds: [1] },
                { programId: 1, collectorIds: [1] },
                { programId: 1, collectorIds: [2] },
            ]),
        ).toBe(2);
    });

    it('counts both people on a Session naming two', () => {
        expect(
            countCollectors([
                { programId: 1, collectorIds: [1, 2] },
                { programId: 1, collectorIds: [2] },
            ]),
        ).toBe(2);
    });

    it('tells apart the same number in different Programs', () => {
        expect(
            countCollectors([
                { programId: 1, collectorIds: [1] },
                { programId: 2, collectorIds: [1] },
            ]),
        ).toBe(2);
    });

    it('skips Sessions with no collector name', () => {
        expect(
            countCollectors([
                { programId: 1, collectorIds: [] },
                { programId: 1, collectorIds: [3] },
            ]),
        ).toBe(1);
    });
});
