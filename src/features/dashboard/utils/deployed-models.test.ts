import { describe, expect, it } from 'vitest';
import {
    listDeployedModels,
    versionLabels,
    versionNumber,
} from './deployed-models';

const program = (programId: number, country: string) => ({
    programId,
    name: `${country} program`,
    country,
});

describe('listDeployedModels', () => {
    it('keeps the order given and leaves out Programs with no release notes', () => {
        const rows = listDeployedModels([
            program(4, 'Kenya'),
            program(5, 'United States of America'),
            program(1, 'Uganda'),
        ]);
        expect(rows.map(row => row.program.programId)).toEqual([4, 1]);
        expect(rows.map(row => row.code)).toEqual(['KE', 'UG']);
    });

    it('lists Uganda’s build and its Amudat-only stephensi build', () => {
        const [uganda] = listDeployedModels([program(1, 'Uganda')]);
        expect(uganda.models.map(model => model.version)).toEqual([
            '1.1.1',
            '1.1.1-stephensi',
        ]);
        expect(uganda.models[1].classes).toHaveLength(8);
        expect(uganda.models[1].areas).toEqual(['Amudat']);
    });
});

describe('versionNumber', () => {
    it('drops the build tag', () => {
        expect(versionNumber('1.1.1-stephensi')).toBe('1.1.1');
        expect(versionNumber('1.0.8-adult-mosquito')).toBe('1.0.8');
        expect(versionNumber('1.0.6')).toBe('1.0.6');
    });
});

describe('versionLabels', () => {
    const build = (version: string) => ({ version, model: '', classes: [] });

    it('labels a build sharing the previous version as its variant', () => {
        expect(
            versionLabels([build('1.1.1'), build('1.1.1-stephensi')]),
        ).toEqual(['v1.1.1', '+stephensi']);
    });

    it('names the Areas a variant is limited to', () => {
        expect(
            versionLabels([
                build('1.1.1'),
                { ...build('1.1.1-stephensi'), areas: ['Amudat'] },
            ]),
        ).toEqual(['v1.1.1', '+stephensi · Amudat']);
    });

    it('drops the tag of a lone build', () => {
        expect(versionLabels([build('1.0.8-adult-mosquito')])).toEqual([
            'v1.0.8',
        ]);
    });
});
