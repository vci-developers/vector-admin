import { describe, expect, it } from 'vitest';
import type { SpecimenGroup } from './build-specimen-points';
import { buildSelectionTimeline } from './build-selection-timeline';

const group = (
    species: string | null,
    count: number,
    sex: string | null = 'Female',
): SpecimenGroup => ({ species, sex, abdomenStatus: null, count });

const at = (iso: string, groups: SpecimenGroup[]) => ({
    collectedAt: Date.parse(iso),
    specimenGroups: groups,
});

const RANKING = ['Anopheles gambiae', 'Culex', 'Mansonia'];

describe('buildSelectionTimeline', () => {
    it('buckets by Monday-started week for short periods, gaps included', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-06-03T10:00:00Z', [group('Culex', 2)]),
                at('2026-06-04T10:00:00Z', [group('Anopheles gambiae', 3)]),
                at('2026-06-24T10:00:00Z', [group('Culex', 1)]),
            ],
            period: { from: '2026-06', to: '2026-06' },
            dimension: 'species',
            ranking: RANKING,
        });

        expect(timeline.granularity).toBe('week');
        expect(
            timeline.buckets.map(b => [
                new Date(b.start).toISOString().slice(0, 10),
                b.total,
            ]),
        ).toEqual([
            ['2026-06-01', 5],
            ['2026-06-08', 0],
            ['2026-06-15', 0],
            ['2026-06-22', 1],
            ['2026-06-29', 0],
        ]);
        expect(timeline.buckets[0].counts).toEqual({
            Culex: 2,
            'Anopheles gambiae': 3,
        });
        expect(timeline.total).toBe(6);
    });

    it('buckets by UTC day when asked, keeping every day of the period', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-06-03T10:00:00Z', [group('Culex', 2)]),
                at('2026-06-03T23:30:00Z', [group('Culex', 1)]),
                at('2026-06-30T06:00:00Z', [group('Anopheles gambiae', 4)]),
            ],
            period: { from: '2026-06', to: '2026-06' },
            dimension: 'species',
            ranking: RANKING,
            granularity: 'day',
        });

        expect(timeline.granularity).toBe('day');
        expect(timeline.buckets).toHaveLength(30);
        expect(
            timeline.buckets
                .filter(b => b.total > 0)
                .map(b => [
                    new Date(b.start).toISOString().slice(0, 10),
                    b.total,
                ]),
        ).toEqual([
            ['2026-06-03', 3],
            ['2026-06-30', 4],
        ]);
        expect(new Date(timeline.buckets[0].start).toISOString()).toBe(
            '2026-06-01T00:00:00.000Z',
        );
    });

    it('buckets by month for longer periods, from the first specimen on', () => {
        const timeline = buildSelectionTimeline({
            sessions: [at('2026-05-20T00:00:00Z', [group('Culex', 4)])],
            period: { from: '2026-03', to: '2026-07' },
            dimension: 'species',
            ranking: RANKING,
        });
        expect(timeline.granularity).toBe('month');
        expect(timeline.buckets.map(b => [b.key, b.total])).toEqual([
            ['2026-05', 4],
            ['2026-06', 0],
            ['2026-07', 0],
        ]);
    });

    it('buckets by quarter past two years', () => {
        // Every five months: no quiet stretch long enough to fold.
        const months = ['2024-02', '2024-07', '2024-12', '2025-05', '2025-10'];
        const timeline = buildSelectionTimeline({
            sessions: [
                ...months.map(month =>
                    at(`${month}-10T00:00:00Z`, [group('Culex', 1)]),
                ),
                at('2026-03-01T00:00:00Z', [group('Culex', 1)]),
                at('2026-08-01T00:00:00Z', [group('Culex', 2)]),
            ],
            period: { from: '2023-01', to: '2026-09' },
            dimension: 'species',
            ranking: RANKING,
        });
        expect(timeline.granularity).toBe('quarter');
        expect(timeline.foldedBefore).toBeNull();
        const keys = timeline.buckets.map(b => b.key);
        expect(keys[0]).toBe('2024-Q1');
        expect(keys.at(-1)).toBe('2026-Q3');
        expect(keys).toHaveLength(11);
        expect(timeline.buckets.at(-1)?.total).toBe(2);
    });

    it('folds data before a quiet half-year into one bar and sizes the rest by what follows', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2021-03-10T00:00:00Z', [group('Culex', 1)]),
                at('2021-05-10T00:00:00Z', [group('Culex', 2)]),
                at('2025-07-10T00:00:00Z', [group('Culex', 3)]),
                at('2025-12-10T00:00:00Z', [group('Culex', 1)]),
                at('2026-04-10T00:00:00Z', [group('Culex', 1)]),
                at('2026-09-10T00:00:00Z', [group('Culex', 4)]),
            ],
            period: { from: '2020-08', to: '2026-10' },
            dimension: 'species',
            ranking: RANKING,
        });
        expect(timeline.granularity).toBe('month');
        expect(timeline.foldedBefore).toBe(Date.parse('2025-07-01T00:00:00Z'));
        expect(timeline.buckets[0]).toMatchObject({
            start: Date.parse('2021-03-01T00:00:00Z'),
            total: 3,
        });
        expect(timeline.buckets[1]).toMatchObject({ key: '2025-07', total: 3 });
        expect(timeline.buckets.at(-1)?.key).toBe('2026-10');
        expect(timeline.buckets).toHaveLength(17);
        expect(timeline.total).toBe(12);
    });

    it('keeps a gap shorter than six months on the axis', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-01-10T00:00:00Z', [group('Culex', 1)]),
                at('2026-07-10T00:00:00Z', [group('Culex', 2)]),
            ],
            period: { from: '2026-01', to: '2026-07' },
            dimension: 'species',
            ranking: RANKING,
        });
        expect(timeline.foldedBefore).toBeNull();
        expect(timeline.buckets.map(b => b.key)).toEqual([
            '2026-01',
            '2026-02',
            '2026-03',
            '2026-04',
            '2026-05',
            '2026-06',
            '2026-07',
        ]);
    });

    it('keeps each value on its map-wide slot and folds the rest', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-06-03T00:00:00Z', [
                    group('Mansonia', 1),
                    group('Aedes aegypti', 2),
                    group(null, 3),
                ]),
            ],
            period: { from: '2026-06', to: '2026-06' },
            dimension: 'species',
            ranking: ['Anopheles gambiae', 'Culex', 'Mansonia'].concat([
                'A',
                'B',
                'C',
                'Aedes aegypti',
            ]),
        });
        expect(timeline.series).toEqual([
            { kind: 'value', key: 'Mansonia', value: 'Mansonia', slot: 2 },
            {
                kind: 'folded',
                key: 'folded',
                hasNamed: true,
                hasNotRecorded: true,
            },
        ]);
        expect(timeline.buckets[0].counts).toEqual({ Mansonia: 1, folded: 5 });
    });

    it('stacks by sex when asked', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-06-03T00:00:00Z', [
                    group('Culex', 2, 'Male'),
                    group('Culex', 1),
                ]),
            ],
            period: { from: '2026-06', to: '2026-06' },
            dimension: 'sex',
            ranking: ['Female', 'Male'],
        });
        expect(timeline.series.map(s => s.key)).toEqual(['Female', 'Male']);
    });

    it('leaves males and non-mosquitoes out when stacking by abdomen', () => {
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2026-06-03T00:00:00Z', [
                    group('Culex', 2, 'Male'),
                    group('Non-Mosquito', 1, null),
                    {
                        species: 'Culex',
                        sex: 'Female',
                        abdomenStatus: 'Fed',
                        count: 3,
                    },
                ]),
            ],
            period: { from: '2026-06', to: '2026-06' },
            dimension: 'abdomen',
            ranking: ['Fed'],
        });

        expect(timeline.total).toBe(3);
        expect(timeline.series.map(s => s.key)).toEqual(['Fed']);
    });
});
