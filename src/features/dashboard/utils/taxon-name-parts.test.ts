import { describe, expect, it } from 'vitest';
import { taxonNameParts } from './taxon-name-parts';

describe('taxonNameParts', () => {
    it('italicises a full species name as one run', () => {
        expect(taxonNameParts('Anopheles gambiae')).toEqual([
            { text: 'Anopheles gambiae', italic: true },
        ]);
        expect(taxonNameParts('An. stephensi')).toEqual([
            { text: 'An. stephensi', italic: true },
        ]);
    });

    it('italicises a genus alone', () => {
        expect(taxonNameParts('Culex')).toEqual([
            { text: 'Culex', italic: true },
        ]);
    });

    it('leaves "other" and qualifiers upright', () => {
        expect(taxonNameParts('Anopheles other')).toEqual([
            { text: 'Anopheles', italic: true },
            { text: ' other', italic: false },
        ]);
        expect(taxonNameParts('An. stephensi (suspected)')).toEqual([
            { text: 'An. stephensi', italic: true },
            { text: ' (suspected)', italic: false },
        ]);
    });

    it('leaves labels that name no taxon upright', () => {
        expect(taxonNameParts('Non-Mosquito')).toEqual([
            { text: 'Non-Mosquito', italic: false },
        ]);
        expect(taxonNameParts('Calibration specimens')).toEqual([
            { text: 'Calibration specimens', italic: false },
        ]);
    });
});
