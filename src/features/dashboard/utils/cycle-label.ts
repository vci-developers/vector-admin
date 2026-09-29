export type CycleLabel =
    | { kind: 'list'; numbers: string; count: number }
    | { kind: 'range'; first: number; last: number; count: number };

// Long periods can overlap hundreds of cycles; past three, show the span.
export function cycleLabel(cycles: number[]): CycleLabel | null {
    if (cycles.length === 0) return null;
    const sorted = [...new Set(cycles)].sort((a, b) => a - b);
    return sorted.length <= 3
        ? { kind: 'list', numbers: sorted.join(', '), count: sorted.length }
        : {
              kind: 'range',
              first: sorted[0],
              last: sorted[sorted.length - 1],
              count: sorted.length,
          };
}
