import type { Program } from '@/api/program/validation/program-schema';

// Prod program 5 (Johns Hopkins University) may be internal test data. Test
// program ids start at 7, so this is a no-op there.
export const HIDDEN_BY_DEFAULT_PROGRAM_IDS = [5];

/** Where a Stakeholder's page opens. */
export const STAKEHOLDER_DEFAULT_COUNTRY = 'Uganda';

/**
 * The Programs the Program Filter leaves out until the viewer changes it.
 * Developers: the Hidden-by-Default list. Stakeholders: every Program they
 * may see except Uganda's, or none when they have no Uganda Program.
 */
export function defaultExcludedPrograms(
    role: 'developer' | 'stakeholder',
    visible: Pick<Program, 'programId' | 'country'>[],
): number[] {
    if (role === 'developer') return HIDDEN_BY_DEFAULT_PROGRAM_IDS;
    const others = visible.filter(
        program => program.country !== STAKEHOLDER_DEFAULT_COUNTRY,
    );
    return others.length < visible.length
        ? others.map(program => program.programId)
        : [];
}
