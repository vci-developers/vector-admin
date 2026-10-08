import { err, ok, type Result } from '@/lib/result/result';

/**
 * Who is looking: a Developer sees everything, a Stakeholder their Programs.
 * `programIds: null` is a Developer previewing the Stakeholder view: every
 * Program, everything else as a Stakeholder.
 */
export type Viewer =
    | { role: 'developer' }
    | { role: 'stakeholder'; programIds: number[] | null };

/** The header switch's choice, kept in a cookie. */
export type ViewAs = 'developer' | 'stakeholder';

export type StakeholderList = Map<string, number[]>;

const ENTRY = /^([^\s:@]+@[^\s:@]+):(\d+(?:\|\d+)*)$/;

/**
 * Reads `STAKEHOLDER_EMAILS`: comma-separated `email:programId|programId`,
 * e.g. `a@who.int:1,b@jhu.edu:1|4`. One malformed entry rejects the whole
 * list, so a typo never admits anyone.
 */
export function parseStakeholderList(
    value: string | undefined,
): Result<StakeholderList, string> {
    const list: StakeholderList = new Map();
    const entries = (value ?? '')
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
    for (const entry of entries) {
        const match = ENTRY.exec(entry);
        if (!match) return err(`Malformed stakeholder entry "${entry}"`);
        const email = match[1].toLowerCase();
        if (list.has(email)) return err(`${email} is listed twice`);
        list.set(email, match[2].split('|').map(Number));
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
    const programIds = list.data.get(email.trim().toLowerCase());
    return programIds ? { role: 'stakeholder', programIds } : null;
}

export function canSeeProgram(viewer: Viewer, programId: number): boolean {
    return (
        viewer.role === 'developer' ||
        viewer.programIds === null ||
        viewer.programIds.includes(programId)
    );
}

/**
 * A Developer who switched to the Stakeholder view is served as one, across
 * every Program. Only a Developer can switch, so it never widens access.
 */
export function applyViewAs(
    viewer: Viewer,
    viewAs: string | undefined,
): Viewer {
    return viewer.role === 'developer' && viewAs === 'stakeholder'
        ? { role: 'stakeholder', programIds: null }
        : viewer;
}
