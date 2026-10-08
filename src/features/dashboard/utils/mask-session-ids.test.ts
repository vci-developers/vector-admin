import { describe, expect, it } from 'vitest';
import { maskSessionIds } from './mask-session-ids';

describe('maskSessionIds', () => {
    it('replaces every real id with a position, unique across both lists', () => {
        const masked = maskSessionIds({
            placed: [
                { sessionId: 9001, specimenCount: 3 },
                { sessionId: 4512, specimenCount: 0 },
            ],
            unplaced: [{ sessionId: 7777, specimenCount: 1 }],
        });

        expect(masked).toEqual({
            placed: [
                { sessionId: 1, specimenCount: 3 },
                { sessionId: 2, specimenCount: 0 },
            ],
            unplaced: [{ sessionId: 3, specimenCount: 1 }],
        });
    });
});
