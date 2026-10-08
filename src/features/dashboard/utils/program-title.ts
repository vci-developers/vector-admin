import type { Program } from '@/api/program/validation/program-schema';

/** One-line form for titles and alerts: "Uganda (National Malaria …)". */
export function programTitle(program: Pick<Program, 'name' | 'country'>) {
    return program.country
        ? `${program.country} (${program.name})`
        : program.name;
}

/**
 * What a set of Programs covers, for naming the whole map: their countries,
 * each once ("Uganda", "Kenya, Uganda"), or a Program's name when its country
 * is blank.
 */
export function scopeTitle(programs: Pick<Program, 'name' | 'country'>[]) {
    return [...new Set(programs.map(p => p.country || p.name))]
        .sort()
        .join(', ');
}
