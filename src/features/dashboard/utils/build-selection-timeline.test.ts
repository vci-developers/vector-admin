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
        const timeline = buildSelectionTimeline({
            sessions: [
                at('2024-02-10T00:00:00Z', [group('Culex', 1)]),
                at('2026-08-01T00:00:00Z', [group('Culex', 2)]),
            ],
            period: { from: '2023-01', to: '2026-09' },
            dimension: 'species',
            ranking: RANKING,
        });
        expect(timeline.granularity).toBe('quarter');
        const keys = timeline.buckets.map(b => b.key);
        expect(keys[0]).toBe('2024-Q1');
        expect(keys.at(-1)).toBe('2026-Q3');
        expect(keys).toHaveLength(11);
        expect(timeline.buckets.at(-1)?.total).toBe(2);
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
});
