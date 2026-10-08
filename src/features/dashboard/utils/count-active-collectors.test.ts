import { describe, expect, it } from 'vitest';
import { countActiveCollectors } from './count-active-collectors';

const named = (...names: string[]) =>
    names.map(collectorName => ({ collectorName }));

describe('countActiveCollectors', () => {
    it('counts each name once, ignoring case, spacing and accents', () => {
        expect(
            countActiveCollectors(
                named(
                    'Okot Alfred',
                    'okot  alfred ',
                    'Alejandro García',
                    'Alejandro Garcia',
                ),
            ),
        ).toBe(2);
    });

    it('counts both people in a joint name', () => {
        expect(
            countActiveCollectors(
                named(
                    'Lokwang John Johnic and Natyang Gloria',
                    'Natyang Gloria',
                    'A & B',
                ),
            ),
        ).toBe(4);
    });

    it('counts no one for a blank name', () => {
        expect(countActiveCollectors(named('', '  ', 'Okot Alfred'))).toBe(1);
    });
});
