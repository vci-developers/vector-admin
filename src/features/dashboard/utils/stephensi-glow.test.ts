import { afterEach, describe, expect, it, vi } from 'vitest';
import { stephensiGlowDelay } from './stephensi-glow';

afterEach(() => vi.restoreAllMocks());

describe('stephensiGlowDelay', () => {
    it('rewinds a new glow to where the shared 3.2s cycle is now', () => {
        vi.spyOn(performance, 'now').mockReturnValue(7000);
        expect(stephensiGlowDelay()).toBe('-600ms');
    });
});
