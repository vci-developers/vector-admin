import { describe, expect, it } from 'vitest';
import {
    describeCoverageError,
    parseCoverageSheets,
    type SheetRow,
} from './parse-coverage-sheets';

function rows(...cells: SheetRow['cells'][]): SheetRow[] {
    return cells.map((row, index) => ({ row: index + 1, cells: row }));
}

const UNITS_HEADER = ['programId', 'program', 'unit', 'status', 'note'];

describe('parseCoverageSheets', () => {
    it('reads units and Field Users, ignoring program, note and old columns', () => {
        const result = parseCoverageSheets({
            units: rows(
                UNITS_HEADER,
                [1, 'Uganda', 'Gulu', 'Active', ''],
                [1, 'Uganda', ' Amuru ', 'Targeted', 'dummy'],
            ),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                units: [
                    {
                        programId: 1,
                        unit: 'Gulu',
                        status: 'Active',
                        boundary: null,
                    },
                    {
                        programId: 1,
                        unit: 'Amuru',
                        status: 'Targeted',
                        boundary: null,
                    },
                ],
                expectedUsers: [],
                projectedDevices: [],
            },
        });
    });

    it('finds columns by header name in any order and case', () => {
        const result = parseCoverageSheets({
            units: rows(['Status', 'Unit', 'ProgramID'], ['Active', 'Gulu', 1]),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result.ok && result.data.units).toEqual([
            { programId: 1, unit: 'Gulu', status: 'Active', boundary: null },
        ]);
    });

    it('reads the optional boundary column, blank meaning the unit name', () => {
        const result = parseCoverageSheets({
            units: rows(
                ['programId', 'unit', 'status', 'boundary'],
                [1, 'Arua-periurban', 'Surveillance only', ' Arua '],
                [1, 'Gulu', 'Active', ''],
            ),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result.ok && result.data.units.map(u => u.boundary)).toEqual([
            'Arua',
            null,
        ]);
    });

    it('accepts numbers typed as text and skips blank rows', () => {
        const result = parseCoverageSheets({
            units: rows(UNITS_HEADER, [null, null, null, null, null]),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                units: [],
                expectedUsers: [],
                projectedDevices: [],
            },
        });
    });

    it('reports an unknown status with its sheet and row', () => {
        const result = parseCoverageSheets({
            units: rows(UNITS_HEADER, [1, 'Uganda', 'Gulu', 'Activ', '']),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toHaveLength(1);
        expect(result.error[0]).toMatchObject({ sheet: 'Units', row: 2 });
        expect(describeCoverageError(result.error[0])).toMatch(
            /^Units row 2: status: /,
        );
    });

    it('reads Expected Users by month, from text or a date cell', () => {
        const result = parseCoverageSheets({
            units: rows(UNITS_HEADER),
            projectedDevices: null,
            expectedUsers: rows(
                ['programId', 'program', 'month', 'expected'],
                [1, 'Uganda', '2026-08', 48],
                [1, 'Uganda', '2026-09-01T00:00:00.000Z', '66'],
            ),
        });

        expect(result.ok && result.data.expectedUsers).toEqual([
            { programId: 1, month: '2026-08', expected: 48 },
            { programId: 1, month: '2026-09', expected: 66 },
        ]);
    });

    it('rejects a bad month or two rows for one month', () => {
        const bad = parseCoverageSheets({
            units: rows(UNITS_HEADER),
            projectedDevices: null,
            expectedUsers: rows(
                ['programId', 'month', 'expected'],
                [1, 'Sept', 66],
            ),
        });
        expect(bad.ok).toBe(false);
        if (!bad.ok)
            expect(bad.error[0]).toMatchObject({
                sheet: 'Expected Users',
                row: 2,
            });

        const twice = parseCoverageSheets({
            units: rows(UNITS_HEADER),
            projectedDevices: null,
            expectedUsers: rows(
                ['programId', 'month', 'expected'],
                [1, '2026-09', 66],
                [1, '2026-09', 60],
            ),
        });
        expect(!twice.ok && twice.error[0]).toMatchObject({
            sheet: 'Expected Users',
            row: 3,
        });
    });

    it('rejects a missing sheet or column', () => {
        const result = parseCoverageSheets({
            units: rows(['programId', 'unit']),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.map(describeCoverageError)).toEqual([
            'Units row 1: Missing column status',
        ]);
        expect(
            parseCoverageSheets({
                units: null,
                expectedUsers: null,
                projectedDevices: null,
            }),
        ).toMatchObject({
            ok: false,
            error: [{ message: 'Sheet is missing' }],
        });
    });

    it('rejects a unit listed twice, however it is spelt', () => {
        const result = parseCoverageSheets({
            units: rows(
                UNITS_HEADER,
                [1, 'Uganda', 'Madi-Okollo', 'Active', ''],
                [1, 'Uganda', 'madi okollo', 'Targeted', ''],
                [2, 'Kenya', 'Madi-Okollo', 'Active', ''],
            ),
            expectedUsers: null,
            projectedDevices: null,
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toEqual([
            {
                sheet: 'Units',
                row: 3,
                message: 'madi okollo is listed twice for Program 1',
            },
        ]);
    });

    it('reads Projected Devices by month', () => {
        const result = parseCoverageSheets({
            units: rows(UNITS_HEADER),
            expectedUsers: null,
            projectedDevices: rows(
                ['programId', 'program', 'month', 'projected'],
                [1, 'Uganda', '2026-09', 66],
                [4, 'Kenya', '2026-10', 14],
            ),
        });

        expect(result.ok && result.data.projectedDevices).toEqual([
            { programId: 1, month: '2026-09', projected: 66 },
            { programId: 4, month: '2026-10', projected: 14 },
        ]);
    });
});
