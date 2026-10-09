import 'server-only';

import {
    EXPECTED_USERS_SHEET,
    parseCoverageSheets,
    PROGRAM_POTENTIAL_SHEET,
    PROJECTED_DEVICES_SHEET,
    UNITS_SHEET,
    type CoverageFigures,
    type CoverageRowError,
    type SheetRow,
} from '@/features/dashboard/utils/parse-coverage-sheets';
import { err, type Result } from '@/lib/result/result';
import ExcelJS from 'exceljs';

function plainCell(value: ExcelJS.CellValue): string | number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    if ('error' in value) return null;
    if ('richText' in value) return value.richText.map(r => r.text).join('');
    if ('formula' in value || 'sharedFormula' in value)
        return plainCell(value.result as ExcelJS.CellValue);
    if ('text' in value) return value.text;
    return null;
}

function sheetRows(
    workbook: ExcelJS.Workbook,
    name: string,
): SheetRow[] | null {
    const sheet = workbook.getWorksheet(name);
    if (!sheet) return null;
    const rows: SheetRow[] = [];
    sheet.eachRow((row, rowNumber) => {
        // row.values is 1-indexed: index 0 is always empty.
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push({
            row: rowNumber,
            cells: Array.from(values, value => plainCell(value)),
        });
    });
    return rows;
}

/** Reads and validates the coverage workbook from .xlsx bytes. */
export async function readCoverageWorkbook(
    bytes: ArrayBuffer,
): Promise<Result<CoverageFigures, CoverageRowError[]>> {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(bytes);
    } catch {
        return err([
            { sheet: 'Workbook', row: null, message: 'Not a readable .xlsx' },
        ]);
    }
    return parseCoverageSheets({
        units: sheetRows(workbook, UNITS_SHEET),
        expectedUsers: sheetRows(workbook, EXPECTED_USERS_SHEET),
        programPotential: sheetRows(workbook, PROGRAM_POTENTIAL_SHEET),
        projectedDevices: sheetRows(workbook, PROJECTED_DEVICES_SHEET),
    });
}
