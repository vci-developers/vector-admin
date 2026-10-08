type HasSession = { sessionId: number };

/**
 * Swaps each Session's real id for a position (1, 2, …) so the map still
 * tells points apart but a Stakeholder never receives a Session's id. Both
 * lists are numbered as one run, so ids stay unique across them.
 */
export function maskSessionIds<
    P extends HasSession,
    U extends HasSession,
>(lists: { placed: P[]; unplaced: U[] }): { placed: P[]; unplaced: U[] } {
    let next = 1;
    const placed = lists.placed.map(point => ({ ...point, sessionId: next++ }));
    const unplaced = lists.unplaced.map(point => ({
        ...point,
        sessionId: next++,
    }));
    return { placed, unplaced };
}
