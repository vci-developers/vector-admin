import type { Program } from '@/api/program/validation/program-schema';

/** One-line form for titles and alerts: "Uganda (National Malaria …)". */
export function programTitle(program: Pick<Program, 'name' | 'country'>) {
    return program.country
        ? `${program.country} (${program.name})`
        : program.name;
}
