import { describe, expect, it } from 'vitest';
import { progressSessionCountsSchema } from './progress-snapshot-schema';

const row = {
    sessionId: 9,
    specimenCount: 2,
    imageCount: 3,
    groups: [{ species: 'Anopheles', sex: 'F', abdomenStatus: null, count: 2 }],
};

describe('progressSessionCountsSchema', () => {
    it('keeps the counts and each group species, discarding sex and abdomen', () => {
        expect(progressSessionCountsSchema.parse({ sessions: [row] })).toEqual([
            {
                sessionId: 9,
                specimenCount: 2,
                imageCount: 3,
                groups: [{ species: 'Anopheles', count: 2 }],
            },
        ]);
    });

    it.each([undefined, null, -1, 1.5, '3'])(
        'rejects an invalid image count (%s) instead of fabricating scans',
        imageCount => {
            expect(
                progressSessionCountsSchema.safeParse({
                    sessions: [{ ...row, imageCount }],
                }).success,
            ).toBe(false);
        },
    );
});
