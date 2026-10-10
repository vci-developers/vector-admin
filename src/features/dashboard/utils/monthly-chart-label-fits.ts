/** Reserve up to 8 px per character for the 13 px label, plus a small inset. */
export function monthlyChartLabelFits(
    value: string,
    barWidth: number,
): boolean {
    return (
        value.length > 0 &&
        Number.isFinite(barWidth) &&
        value.length * 8 + 4 <= barWidth
    );
}
