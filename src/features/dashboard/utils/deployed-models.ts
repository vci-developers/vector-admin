import type { Program } from '@/api/program/validation/program-schema';
import { programCode } from './program-title';

/** The species model in a Program's latest app build. */
export type DeployedModel = {
    /** App version as the release notes name it, build tag included. */
    version: string;
    /** The notes' name for it, e.g. "ConvNeXt Nano species model". */
    model: string;
    /** What the model tells apart, Non-mosquito included. */
    classes: string[];
    /** The only Areas running this build; the whole Program when omitted. */
    areas?: string[];
};

const UGANDA_CLASSES = [
    'An. gambiae',
    'An. funestus',
    'Anopheles other',
    'Culex',
    'Aedes',
    'Mansonia',
    'Non-mosquito',
];

/**
 * Hand-copied from each Program's release notes (the team's "Release Notes"
 * Word documents), keyed by Program Country; update when a new build ships.
 * Uganda runs 1.1.1 (29 Sep 2026); its stephensi build of the same version
 * is deployed only in Amudat.
 */
const DEPLOYED_MODELS: Record<string, DeployedModel[]> = {
    Uganda: [
        {
            version: '1.1.1',
            model: 'ConvNeXt Nano species model',
            classes: UGANDA_CLASSES,
        },
        {
            version: '1.1.1-stephensi',
            model: 'ConvNeXt Nano stephensi model',
            classes: [...UGANDA_CLASSES, 'An. stephensi (suspected)'],
            areas: ['Amudat'],
        },
    ],
    Kenya: [
        {
            version: '1.0.6',
            model: 'Calibrated Kenya model',
            classes: [...UGANDA_CLASSES, 'An. stephensi'],
        },
    ],
    // The notes say only "Uganda models" (v1.0.1); later builds keep them.
    Ghana: [
        {
            version: '1.0.4',
            model: 'Uganda species model',
            classes: UGANDA_CLASSES,
        },
    ],
    Colombia: [
        {
            version: '1.0.8-adult-mosquito',
            model: 'Colombia 8-class adult mosquito model',
            classes: [
                'Ae. aegypti',
                'Ae. albopictus',
                'An. albimanus',
                'An. darlingi',
                'An. nuneztovari',
                'Culex',
                'Mansonia',
                'Non-mosquito',
            ],
        },
    ],
    Cameroon: [
        { version: '1.0.2', model: 'Species model', classes: UGANDA_CLASSES },
    ],
};

/** "1.1.1" from "1.1.1-stephensi": the version without its build tag. */
export function versionNumber(version: string): string {
    return version.split('-')[0];
}

/**
 * A badge label per build: "v1.0.8" alone, the tag dropped; a build sharing
 * the previous one's version reads as its variant, "+stephensi", and names
 * where it runs when that is only some Areas ("+stephensi · Amudat").
 */
export function versionLabels(models: DeployedModel[]): string[] {
    return models.map((model, index) => {
        const number = versionNumber(model.version);
        const previous = models[index - 1];
        if (!previous || versionNumber(previous.version) !== number)
            return `v${number}`;
        const variant = `+${model.version.slice(number.length + 1)}`;
        return model.areas ? `${variant} · ${model.areas.join(', ')}` : variant;
    });
}

/** Each Program's deployed models, in the order given; Programs with none are left out. */
export function listDeployedModels(
    programs: Program[],
): { program: Program; code: string; models: DeployedModel[] }[] {
    return programs.flatMap(program => {
        const models = DEPLOYED_MODELS[program.country];
        return models
            ? [
                  {
                      program,
                      code: programCode(program),
                      models,
                  },
              ]
            : [];
    });
}
