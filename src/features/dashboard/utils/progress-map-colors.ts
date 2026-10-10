const SCAN_COLOR_STOPS = [
    [215, 245, 223],
    [148, 228, 178],
    [56, 189, 132],
    [17, 137, 99],
    [7, 83, 68],
];

export const PROGRESS_SCAN_FILL_OPACITY = 0.86;
export const PROGRESS_SCAN_LEGEND = `linear-gradient(to right, ${SCAN_COLOR_STOPS.map(color => `rgb(${color.join(' ')})`).join(', ')})`;

/** Keep one continuous volume scale across all displayed reporting areas. */
export function progressScanFillColor(scans: number, maximum: number): string {
    const intensity = Math.sqrt(
        Math.min(1, Math.max(0, scans) / Math.max(1, maximum)),
    );
    const position = intensity * (SCAN_COLOR_STOPS.length - 1);
    const index = Math.min(Math.floor(position), SCAN_COLOR_STOPS.length - 2);
    const fraction = position - index;
    const color = SCAN_COLOR_STOPS[index].map((channel, channelIndex) =>
        Math.round(
            channel +
                fraction *
                    (SCAN_COLOR_STOPS[index + 1][channelIndex] - channel),
        ),
    );
    return `rgb(${color.join(' ')})`;
}
