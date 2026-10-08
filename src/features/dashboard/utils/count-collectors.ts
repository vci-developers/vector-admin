type Collected = { programId: number; collectorIds: number[] };

/**
 * Distinct collectors behind some Sessions. Collector numbers restart in each
 * Program, so a Program's 1 and another's 1 are two people.
 */
export function countCollectors(sessions: Collected[]): number {
    const collectors = new Set<string>();
    for (const { programId, collectorIds } of sessions) {
        for (const id of collectorIds) collectors.add(`${programId}:${id}`);
    }
    return collectors.size;
}
