import { err, ok } from '@/lib/result/result';
import { describe, expect, it } from 'vitest';
import {
    applyViewAs,
    canSeeProgram,
    parseStakeholderList,
    resolveViewer,
} from './viewer';

describe('parseStakeholderList', () => {
    it('reads emails, lower-cased, ignoring an old Program suffix', () => {
        expect(parseStakeholderList(' A@WHO.int , b@jhu.edu:1|4 ')).toEqual(
            ok(new Set(['a@who.int', 'b@jhu.edu'])),
        );
    });

    it('treats unset or blank as nobody', () => {
        expect(parseStakeholderList(undefined)).toEqual(ok(new Set()));
        expect(parseStakeholderList(' , ')).toEqual(ok(new Set()));
    });

    it.each(['a@who.int:', 'a@who.int:one', 'who.int:1', 'a@who.int:1|'])(
        'rejects the whole list for %j',
        entry => {
            const result = parseStakeholderList(`ok@jhu.edu,${entry}`);
            expect(result.ok).toBe(false);
        },
    );

    it('rejects an email listed twice', () => {
        expect(parseStakeholderList('a@who.int,A@who.int:4').ok).toBe(false);
    });
});

describe('resolveViewer', () => {
    const list = ok(new Set(['a@who.int']));

    it('makes anyone with devMode a Developer, listed or not', () => {
        expect(resolveViewer(true, 'a@who.int', list)).toEqual({
            role: 'developer',
        });
        expect(resolveViewer(true, null, err('broken'))).toEqual({
            role: 'developer',
        });
    });

    it('makes a listed email a Stakeholder over every shown Program', () => {
        expect(resolveViewer(false, ' A@Who.int ', list)).toEqual({
            role: 'stakeholder',
            programIds: null,
        });
    });

    it('refuses an unlisted email, a missing one, or any on a broken list', () => {
        expect(resolveViewer(false, 'c@who.int', list)).toBeNull();
        expect(resolveViewer(false, null, list)).toBeNull();
        expect(resolveViewer(false, 'a@who.int', err('broken'))).toBeNull();
    });
});

describe('canSeeProgram', () => {
    it('shows a Stakeholder every Program but the hidden ones; a Developer all', () => {
        const stakeholder = { role: 'stakeholder' as const, programIds: null };
        expect(canSeeProgram(stakeholder, 4)).toBe(true);
        expect(canSeeProgram(stakeholder, 5)).toBe(false);
        expect(canSeeProgram({ role: 'developer' }, 5)).toBe(true);
    });

    it('still honours an explicit Program list', () => {
        const narrowed = { role: 'stakeholder' as const, programIds: [1] };
        expect(canSeeProgram(narrowed, 1)).toBe(true);
        expect(canSeeProgram(narrowed, 4)).toBe(false);
    });
});

describe('applyViewAs', () => {
    const stakeholder = { role: 'stakeholder' as const, programIds: [1] };

    it('serves a Developer who switched as a Stakeholder over every shown Program', () => {
        const preview = applyViewAs({ role: 'developer' }, 'stakeholder');
        expect(preview).toEqual({ role: 'stakeholder', programIds: null });
        expect(canSeeProgram(preview, 4)).toBe(true);
        expect(canSeeProgram(preview, 5)).toBe(false);
    });

    it('only serves a Developer internally after an explicit choice', () => {
        expect(applyViewAs({ role: 'developer' }, 'developer')).toEqual({
            role: 'developer',
        });
        for (const choice of [undefined, 'stakeholder', 'invalid']) {
            expect(applyViewAs({ role: 'developer' }, choice)).toEqual({
                role: 'stakeholder',
                programIds: null,
            });
        }
    });

    it('never widens a Stakeholder, whatever the cookie', () => {
        expect(applyViewAs(stakeholder, undefined)).toBe(stakeholder);
        expect(applyViewAs(stakeholder, 'invalid')).toBe(stakeholder);
        expect(canSeeProgram(applyViewAs(stakeholder, 'developer'), 4)).toBe(
            false,
        );
        expect(applyViewAs(stakeholder, 'stakeholder')).toBe(stakeholder);
        expect(applyViewAs(stakeholder, 'developer')).toBe(stakeholder);
    });
});
