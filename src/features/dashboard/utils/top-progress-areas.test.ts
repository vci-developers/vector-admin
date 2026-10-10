import { describe, expect, it } from 'vitest';
import { topProgressAreas } from './top-progress-areas';

const area = (
    key: string,
    country: string,
    name: string,
    uniqueScans: number,
) => ({
    key,
    country,
    name,
    uniqueScans,
    position: null,
});

describe('top progress areas', () => {
    it('compares geographic scan totals across programs, retaining areas without coordinates or recorded names', () => {
        const rows = Object.freeze([
            Object.freeze(area('uganda:gulu', 'Uganda', 'Gulu', 30)),
            Object.freeze(area('ghana:ada', 'Ghana', 'Ada East', 70)),
            Object.freeze(
                area('uganda:1:unknown', 'Uganda', 'District not recorded', 40),
            ),
            Object.freeze(area('kenya:turkana', 'Kenya', 'Turkana', 0)),
        ]);

        expect(topProgressAreas(rows).map(row => row.key)).toEqual([
            'ghana:ada',
            'uganda:1:unknown',
            'uganda:gulu',
        ]);
        expect(rows.map(row => row.uniqueScans)).toEqual([30, 70, 40, 0]);
        expect(topProgressAreas(rows)[0]).toBe(rows[1]);
    });

    it('limits the list to six areas and preserves the exact counts', () => {
        const rows = Array.from({ length: 9 }, (_, index) =>
            area(`uganda:${index}`, 'Uganda', `Area ${index}`, index * 10),
        );
        expect(topProgressAreas(rows).map(row => row.uniqueScans)).toEqual([
            80, 70, 60, 50, 40, 30,
        ]);
    });

    it('orders equal volumes consistently and leaves zero-only selections empty', () => {
        const rows = [
            area('uganda:b', 'Uganda', 'Gulu', 10),
            area('uganda:a', 'Uganda', 'Gulu', 10),
            area('ghana:b', 'Ghana', 'Yendi', 10),
            area('ghana:a', 'Ghana', 'Ada East', 10),
        ];
        expect(topProgressAreas(rows).map(row => row.key)).toEqual([
            'ghana:a',
            'ghana:b',
            'uganda:a',
            'uganda:b',
        ]);
        expect(topProgressAreas(rows.toReversed())).toEqual(
            topProgressAreas(rows),
        );
        expect(
            topProgressAreas([area('uganda:zero', 'Uganda', 'Gulu', 0)]),
        ).toEqual([]);
        expect(topProgressAreas([])).toEqual([]);
    });
});
