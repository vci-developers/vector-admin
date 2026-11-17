type Rgb = readonly [number, number, number];

const SCAN_COLOR_STOPS: readonly Rgb[] = [
    [215, 245, 223],
    [148, 228, 178],
    [56, 189, 132],
    [17, 137, 99],
    [7, 83, 68],
];

/** The same steps in the An. stephensi colour (#b5176f at the fourth). */
const STEPHENSI_COLOR_STOPS: readonly Rgb[] = [
    [250, 221, 236],
    [238, 157, 199],
    [214, 78, 148],
    [181, 23, 111],
    [112, 10, 68],
];

export const PROGRESS_SCAN_FILL_OPACITY = 0.86;
/** A country's border on the timeline once its first upload is in. */
export const PROGRESS_STARTED_BORDER = 'rgb(17 137 99)';
export const PROGRESS_SCAN_LEGEND = legend(SCAN_COLOR_STOPS);
export const PROGRESS_STEPHENSI_LEGEND = legend(STEPHENSI_COLOR_STOPS);

function legend(stops: readonly Rgb[]) {
    return `linear-gradient(to right, ${stops.map(color => `rgb(${color.join(' ')})`).join(', ')})`;
}

function fillColor(
    stops: readonly Rgb[],
    count: number,
    maximum: number,
    even: boolean,
): string {
    const share = Math.min(1, Math.max(0, count) / Math.max(1, maximum));
    const intensity = even ? share : Math.sqrt(share);
    const position = intensity * (stops.length - 1);
    const index = Math.min(Math.floor(position), stops.length - 2);
    const fraction = position - index;
    const color = stops[index].map((channel, channelIndex) =>
        Math.round(
            channel + fraction * (stops[index + 1][channelIndex] - channel),
        ),
    );
    return `rgb(${color.join(' ')})`;
}

/** Keep one continuous volume scale across all displayed reporting areas. */
export function progressScanFillColor(
    scans: number,
    maximum: number,
    /**
     * Darken in step with the count. The timeline uses it, so places don't jump
     * most of the way on their first month; otherwise small counts are lifted.
     */
    even = false,
): string {
    return fillColor(SCAN_COLOR_STOPS, scans, maximum, even);
}

/** The scan scale's steps in purple, for An. stephensi specimens. */
export function progressStephensiFillColor(
    specimens: number,
    maximum: number,
    even = false,
): string {
    return fillColor(STEPHENSI_COLOR_STOPS, specimens, maximum, even);
}
