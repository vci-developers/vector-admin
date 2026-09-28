const SERIES_SLOTS = 8;

// Color follows the Program, not its position in the current selection, so a
// filter change never repaints the remaining lines. Past eight Programs the
// rest share a neutral color rather than a generated hue.
export function programSeriesColor(
    programId: number,
    allProgramIds: number[],
): string {
    const slot = [...allProgramIds].sort((a, b) => a - b).indexOf(programId);
    return slot >= 0 && slot < SERIES_SLOTS
        ? `var(--series-${slot + 1})`
        : 'var(--series-other)';
}
