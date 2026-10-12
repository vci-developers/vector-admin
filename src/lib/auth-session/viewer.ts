import { HIDDEN_BY_DEFAULT_PROGRAM_IDS } from '@/features/dashboard/utils/default-excluded-programs';
import { err, ok, type Result } from '@/lib/result/result';

/**
 * Who is looking: a Developer sees everything. A Stakeholder, or a Developer
 * previewing the Stakeholder view, has `programIds: null`: every Program the
 * Stakeholder page shows, that is all but the Hidden-by-Default ones. A list
 * of ids would narrow that; nothing assigns one today.
 */
export type Viewer =
    | { role: 'developer' }
    | { role: 'stakeholder'; programIds: number[] | null };

/** The header switch's choice, kept in a cookie. */
export type ViewAs = 'developer' | 'stakeholder';

export type StakeholderList = Set<string>;

// The old `:programId|programId` suffix is still accepted and ignored.
const ENTRY = /^([^\s:@]+@[^\s:@]+)(?::\d+(?:\|\d+)*)?$/;

/**
 * Reads `STAKEHOLDER_EMAILS`: comma-separated emails, e.g.
 * `a@who.int,b@jhu.edu`. One malformed entry rejects the whole list, so a
 * typo never admits anyone.
 */
export function parseStakeholderList(
    value: string | undefined,
): Result<StakeholderList, string> {
    const list: StakeholderList = new Set();
    const entries = (value ?? '')
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
    for (const entry of entries) {
        const match = ENTRY.exec(entry);
        if (!match) return err(`Malformed stakeholder entry "${entry}"`);
        const email = match[1].toLowerCase();
        if (list.has(email)) return err(`${email} is listed twice`);
        list.add(email);
    }
    return ok(list);
}

/** devMode wins; otherwise the email must be on a valid list. */
export function resolveViewer(
    devMode: boolean,
    email: string | null,
    list: Result<StakeholderList, string>,
): Viewer | null {
    if (devMode) return { role: 'developer' };
    if (!email || !list.ok) return null;
    return list.data.has(email.trim().toLowerCase())
        ? { role: 'stakeholder', programIds: null }
        : null;
}

export function canSeeProgram(viewer: Viewer, programId: number): boolean {
    return (
        viewer.role === 'developer' ||
        (viewer.programIds === null
            ? !HIDDEN_BY_DEFAULT_PROGRAM_IDS.includes(programId)
            : viewer.programIds.includes(programId))
    );
}

/**
 * Developers open the progress dashboard by default and explicitly choose
 * the internal view. Only Developers can switch, so a Stakeholder's Program
 * permissions are never widened by the cookie.
 */
export function applyViewAs(
    viewer: Viewer,
    viewAs: string | undefined,
): Viewer {
    return viewer.role === 'developer' && viewAs !== 'developer'
        ? { role: 'stakeholder', programIds: null }
        : viewer;
}
