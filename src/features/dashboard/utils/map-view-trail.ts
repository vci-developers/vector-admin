/** What the map is narrowed to: the steps the Back button retraces. */
export type MapView = {
    country: string | null;
    districtKey: string | null;
    stephensi: boolean;
    /** Programs left out; null for the viewer's default selection. */
    exclude: readonly number[] | null;
};

export function sameMapView(a: MapView, b: MapView): boolean {
    return (
        a.country === b.country &&
        a.districtKey === b.districtKey &&
        a.stephensi === b.stephensi &&
        (a.exclude ?? []).join(',') === (b.exclude ?? []).join(',') &&
        (a.exclude === null) === (b.exclude === null)
    );
}

/** Adds `view` unless it is already the last step; keeps the last `limit`. */
export function pushMapView(
    trail: readonly MapView[],
    view: MapView,
    limit = 20,
): MapView[] {
    const last = trail.at(-1);
    if (last && sameMapView(last, view)) return [...trail];
    return [...trail, view].slice(-limit);
}

/**
 * The last step that differs from `current`, and the trail before it. Steps
 * that match (a click that changed nothing) are skipped.
 */
export function previousMapView(
    trail: readonly MapView[],
    current: MapView,
): { view: MapView | null; rest: MapView[] } {
    for (let index = trail.length - 1; index >= 0; index--)
        if (!sameMapView(trail[index], current))
            return { view: trail[index], rest: trail.slice(0, index) };
    return { view: null, rest: [] };
}
