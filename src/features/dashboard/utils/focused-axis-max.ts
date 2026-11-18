/** Rounds up to 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(value: number): number {
    if (value <= 0) return 0;
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 2.5, 5, 10].find(step => step * power >= value) ?? 10;
    return step * power;
}

/**
 * The specimen axis's top when one species is focused: its busiest month,
 * rounded up, so its bars fill the chart and the rest of each month's
 * specimens run off the top. Null when it has none.
 */
export function focusedAxisMax(
    months: readonly { specimens?: Record<string, number> }[],
    species: string,
): number | null {
    const tallest = Math.max(
        0,
        ...months.map(month => month.specimens?.[species] ?? 0),
    );
    return tallest > 0 ? niceCeiling(tallest * 1.05) : null;
}
