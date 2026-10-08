/**
 * One name as a key: case, spacing and accents ignored, so "García" and
 * "garcia" are one person.
 */
const nameKey = (name: string) =>
    name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

/**
 * The people a Session's collector name stands for, as keys: a name joining
 * two people ("A and B", "A & B") gives both; a blank name gives none.
 */
export function collectorKeys(collectorName: string): string[] {
    return collectorName
        .split(/\s+(?:and|&)\s+/i)
        .map(nameKey)
        .filter(Boolean);
}

/**
 * Active collectors: distinct people named on the given Sessions, by
 * `collectorKeys`. Every user figure counts this way. A name is not an
 * identity: a misspelling still counts twice.
 */
export function countActiveCollectors(
    sessions: { collectorName: string }[],
): number {
    return new Set(sessions.flatMap(s => collectorKeys(s.collectorName))).size;
}
