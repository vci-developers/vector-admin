import { err, ok } from '@/lib/result/result';
import { describe, expect, it } from 'vitest';
import {
    applyViewAs,
    canSeeProgram,
    parseStakeholderList,
    resolveViewer,
} from './viewer';

describe('parseStakeholderList', () => {
    it('reads emails with their Programs, lower-casing emails', () => {
        expect(parseStakeholderList(' A@WHO.int:1 , b@jhu.edu:1|4 ')).toEqual(
            ok(
                new Map([
                    ['a@who.int', [1]],
                    ['b@jhu.edu', [1, 4]],
                ]),
            ),
        );
    });

    it('treats unset or blank as nobody', () => {
        expect(parseStakeholderList(undefined)).toEqual(ok(new Map()));
        expect(parseStakeholderList(' , ')).toEqual(ok(new Map()));
    });

    it.each([
        'a@who.int',
        'a@who.int:',
        'a@who.int:one',
        'who.int:1',
        'a@who.int:1|',
    ])('rejects the whole list for %j', entry => {
        const result = parseStakeholderList(`ok@jhu.edu:1,${entry}`);
        expect(result.ok).toBe(false);
    });

    it('rejects an email listed twice', () => {
        expect(parseStakeholderList('a@who.int:1,A@who.int:4').ok).toBe(false);
    });
});

describe('resolveViewer', () => {
    const list = ok(new Map([['a@who.int', [1]]]));

    it('makes anyone with devMode a Developer, listed or not', () => {
        expect(resolveViewer(true, 'a@who.int', list)).toEqual({
            role: 'developer',
        });
        expect(resolveViewer(true, null, err('broken'))).toEqual({
            role: 'developer',
        });
    });

    it('makes a listed email a Stakeholder with its Programs', () => {
        expect(resolveViewer(false, ' A@Who.int ', list)).toEqual({
            role: 'stakeholder',
            programIds: [1],
        });
    });

    it('refuses an unlisted email, a missing one, or any on a broken list', () => {
        expect(resolveViewer(false, 'c@who.int', list)).toBeNull();
        expect(resolveViewer(false, null, list)).toBeNull();
        expect(resolveViewer(false, 'a@who.int', err('broken'))).toBeNull();
    });
});

describe('canSeeProgram', () => {
    it('limits a Stakeholder to their Programs, not a Developer', () => {
        const stakeholder = { role: 'stakeholder' as const, programIds: [1] };
        expect(canSeeProgram(stakeholder, 1)).toBe(true);
        expect(canSeeProgram(stakeholder, 4)).toBe(false);
        expect(canSeeProgram({ role: 'developer' }, 4)).toBe(true);
    });
});

describe('applyViewAs', () => {
    const stakeholder = { role: 'stakeholder' as const, programIds: [1] };

    it('serves a Developer who switched as a Stakeholder over every Program', () => {
        const preview = applyViewAs({ role: 'developer' }, 'stakeholder');
        expect(preview).toEqual({ role: 'stakeholder', programIds: null });
        expect(canSeeProgram(preview, 4)).toBe(true);
    });

    it('leaves a Developer alone otherwise, and never widens a Stakeholder', () => {
        expect(applyViewAs({ role: 'developer' }, 'developer')).toEqual({
            role: 'developer',
        });
        expect(applyViewAs({ role: 'developer' }, undefined)).toEqual({
            role: 'developer',
        });
        expect(applyViewAs(stakeholder, 'stakeholder')).toBe(stakeholder);
        expect(applyViewAs(stakeholder, 'developer')).toBe(stakeholder);
    });
});
