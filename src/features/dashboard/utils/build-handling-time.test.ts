import { describe, expect, it } from 'vitest';
import { timeSessionImages, timingStats } from './build-handling-time';

const at = (specimenId: number, seconds: number) => ({
    specimenId,
    capturedAt: seconds * 1000,
});

describe('timingStats', () => {
    it('matches Excel PERCENTILE.INC and STDEV.S', () => {
        // Excel: =PERCENTILE.INC({10,20,30,40,100},0.25) = 20, 0.75 = 40,
        // =STDEV.S(...) = 35.355...
        expect(timingStats([40, 10, 100, 30, 20])).toEqual({
            count: 5,
            median: 30,
            p25: 20,
            p75: 40,
            mean: 40,
            sd: expect.closeTo(35.3553, 4),
        });
    });

    it('interpolates between ranks', () => {
        expect(timingStats([10, 20, 30, 40])).toMatchObject({
            median: 25,
            p25: 17.5,
            p75: 32.5,
        });
    });

    it('has no SD for one value and no stats for none', () => {
        expect(timingStats([12])?.sd).toBeNull();
        expect(timingStats([])).toBeNull();
    });
});

describe('timeSessionImages', () => {
    it('times every gap in capture order, retakes and pauses included', () => {
        expect(
            timeSessionImages([at(2, 50), at(1, 0), at(1, 15), at(3, 3650)]),
        ).toEqual({ images: 4, gaps: [15, 35, 3600] });
    });

    it('ignores images with no capture time', () => {
        expect(timeSessionImages([at(1, 0), { capturedAt: null }])).toEqual({
            images: 1,
            gaps: [],
        });
    });
});
