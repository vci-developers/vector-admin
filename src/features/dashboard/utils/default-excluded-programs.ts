// Prod program 5 (Johns Hopkins University) may be internal test data. Test
// program ids start at 7, so this is a no-op there.
export const HIDDEN_BY_DEFAULT_PROGRAM_IDS = [5];

/**
 * The Programs the Program Filter leaves out until the viewer changes it.
 * Developers: the Hidden-by-Default list. Stakeholders: none, since they never
 * see a Hidden-by-Default Program.
 */
export function defaultExcludedPrograms(
    role: 'developer' | 'stakeholder',
): number[] {
    return role === 'developer' ? HIDDEN_BY_DEFAULT_PROGRAM_IDS : [];
}
