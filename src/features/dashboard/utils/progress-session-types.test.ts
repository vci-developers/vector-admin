import { describe, expect, it } from 'vitest';
import {
    scanTypeBreakdown,
    selectProgressSessionTypes,
    sumScansByType,
} from './progress-session-types';

describe('selectProgressSessionTypes', () => {
    it('drops CALIBRATION and keeps schema order', () => {
        expect(
            selectProgressSessionTypes([
                'PRACTICE',
                'CALIBRATION',
                'SURVEILLANCE',
            ]),
        ).toEqual(['SURVEILLANCE', 'PRACTICE']);
    });

    it('falls back to surveillance when nothing applicable is selected', () => {
        expect(selectProgressSessionTypes(['CALIBRATION'])).toEqual([
            'SURVEILLANCE',
        ]);
    });
});

describe('scanTypeBreakdown', () => {
    it('lists types with scans when at least two have them', () => {
        expect(
            scanTypeBreakdown([
                { type: 'SURVEILLANCE', scans: 41 },
                { type: 'DATA_COLLECTION', scans: 0 },
                { type: 'PRACTICE', scans: 8 },
            ]),
        ).toEqual([
            { type: 'SURVEILLANCE', scans: 41 },
            { type: 'PRACTICE', scans: 8 },
        ]);
    });

    it('is empty when only one type has scans', () => {
        expect(
            scanTypeBreakdown([
                { type: 'SURVEILLANCE', scans: 49 },
                { type: 'PRACTICE', scans: 0 },
            ]),
        ).toEqual([]);
    });
});

describe('sumScansByType', () => {
    it('adds each type across groups in schema order', () => {
        expect(
            sumScansByType([
                [
                    { type: 'PRACTICE', scans: 3 },
                    { type: 'SURVEILLANCE', scans: 10 },
                ],
                [{ type: 'SURVEILLANCE', scans: 5 }],
            ]),
        ).toEqual([
            { type: 'SURVEILLANCE', scans: 15 },
            { type: 'PRACTICE', scans: 3 },
        ]);
    });
});
