/** Seconds; percentiles and SD as Excel's PERCENTILE.INC and STDEV.S. */
export type TimingStats = {
    count: number;
    median: number;
    p25: number;
    p75: number;
    mean: number;
    /** Null with a single value: a sample SD needs two. */
    sd: number | null;
};

/** How one Session's images were taken, in capture order. */
export type SessionHandling = {
    /** Images with a capture time. */
    images: number;
    /** Seconds from each image to the next, pauses and retakes included. */
    gaps: number[];
};

type TimedImage = { capturedAt?: number | null };

// Linear interpolation between closest ranks, as Excel's PERCENTILE.INC.
function percentile(sorted: number[], fraction: number): number {
    const rank = (sorted.length - 1) * fraction;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export function timingStats(values: number[]): TimingStats | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const sd =
        sorted.length < 2
            ? null
            : Math.sqrt(
                  sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
                      (sorted.length - 1),
              );
    return {
        count: sorted.length,
        median: percentile(sorted, 0.5),
        p25: percentile(sorted, 0.25),
        p75: percentile(sorted, 0.75),
        mean,
        sd,
    };
}

/** Times one Session's images: every gap between consecutive captures. */
export function timeSessionImages(images: TimedImage[]): SessionHandling {
    const times = images
        .map(image => image.capturedAt)
        .filter((time): time is number => Number.isFinite(time))
        .sort((a, b) => a - b);
    return {
        images: times.length,
        gaps: times.slice(1).map((time, i) => (time - times[i]) / 1000),
    };
}
