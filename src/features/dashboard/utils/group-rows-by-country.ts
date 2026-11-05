import type { Program } from '@/api/program/validation/program-schema';

export type CountryGroup<Row> = { country: string | null; rows: Row[] };

/**
 * One group per Program Country, in first-seen order. A row whose Program is
 * unknown has no country to share, so it stands alone.
 */
export function groupRowsByCountry<Row extends { programId: number }>(
    rows: readonly Row[],
    programs: ReadonlyMap<number, Program>,
): CountryGroup<Row>[] {
    const groups = new Map<string, CountryGroup<Row>>();
    for (const row of rows) {
        const country = programs.get(row.programId)?.country || null;
        const key = country ?? `program:${row.programId}`;
        const group = groups.get(key) ?? { country, rows: [] };
        group.rows.push(row);
        groups.set(key, group);
    }
    return [...groups.values()];
}
