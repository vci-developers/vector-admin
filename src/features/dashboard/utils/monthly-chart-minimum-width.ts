type MonthlyChartLabel = { value: string; month: string };

/** Allow each exact value and date its own readable column, plus the y-axis. */
export function monthlyChartMinimumWidth(
    labels: readonly MonthlyChartLabel[],
): number {
    const column = labels.reduce(
        (width, label) =>
            Math.max(
                width,
                label.value.length * 8 + 24,
                label.month.length * 7 + 24,
            ),
        76,
    );
    return 52 + labels.length * column;
}
