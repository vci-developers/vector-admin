import type { LocationLevel } from './build-location-tree';

/**
 * The place names every path shares, broadest first: all of a single path, and
 * less the more the paths spread out. Empty when any path is unknown.
 */
export function sharedLocationPath(paths: LocationLevel[][]): LocationLevel[] {
    if (paths.length === 0) return [];
    const [first, ...rest] = paths;
    let depth = first.length;
    for (const path of rest) {
        let same = 0;
        while (
            same < Math.min(depth, path.length) &&
            path[same].level === first[same].level &&
            path[same].name === first[same].name
        ) {
            same += 1;
        }
        depth = same;
        if (depth === 0) break;
    }
    return first.slice(0, depth);
}
