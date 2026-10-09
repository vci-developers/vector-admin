import { err, ok, type Result } from '@/lib/result/result';
import { z } from 'zod';

export const COVERAGE_STATUSES = [
    'Active',
    'Targeted',
    'Surveillance only',
] as const;

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

/** One worksheet row as plain values, numbered as Excel shows it. */
export type SheetRow = { row: number; cells: (string | number | null)[] };

/** The coverage workbook's sheets; null when a sheet is missing. */
export type CoverageSheets = {
    units: SheetRow[] | null;
    /** Optional, as is Program Potential: without it, no expected figures. */
    expectedUsers: SheetRow[] | null;
    programPotential: SheetRow[] | null;
    /** Optional: without it, the Stakeholder map's device counts aren't capped. */
    projectedDevices?: SheetRow[] | null;
};

export const UNITS_SHEET = 'Geographic Units';
export const EXPECTED_USERS_SHEET = 'Expected Users';
export const PROGRAM_POTENTIAL_SHEET = 'Targeted Users';
export const PROJECTED_DEVICES_SHEET = 'Projected Devices';

const programIdSchema = z.coerce.number().int().positive();
const countSchema = z.coerce.number().int().nonnegative();

export const coverageUnitRowSchema = z.object({
    programId: programIdSchema,
    unit: z.string().trim().min(1),
    status: z.enum(COVERAGE_STATUSES),
    /** The map shape's name when it differs from `unit`; optional column. */
    boundary: z
        .string()
        .trim()
        .optional()
        .transform(name => name || null),
});

/** "2026-09", or a date cell in that month. */
const monthSchema = z.coerce
    .string()
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])/, 'expected a month like 2026-09')
    .transform(value => value.slice(0, 7));

/** Field Users expected to be using VectorCam in a month. */
export const expectedUsersRowSchema = z.object({
    programId: programIdSchema,
    month: monthSchema,
    expected: countSchema,
});

/** Field Users the Program could reach in full: the user target. */
export const programPotentialRowSchema = z.object({
    programId: programIdSchema,
    programPotential: countSchema,
});

export type CoverageUnit = z.infer<typeof coverageUnitRowSchema>;
export type ExpectedUsers = z.infer<typeof expectedUsersRowSchema>;
/** Devices the Program plans to have out in a month: caps the map's counts. */
export const projectedDevicesRowSchema = z.object({
    programId: programIdSchema,
    month: monthSchema,
    projected: countSchema,
});

export type ProgramPotential = z.infer<typeof programPotentialRowSchema>;
export type ProjectedDevices = z.infer<typeof projectedDevicesRowSchema>;

export type CoverageFigures = {
    units: CoverageUnit[];
    expectedUsers: ExpectedUsers[];
    programPotential: ProgramPotential[];
    projectedDevices: ProjectedDevices[];
};

export type CoverageRowError = {
    sheet: string;
    /** null when the problem is the sheet itself (missing, no header). */
    row: number | null;
    message: string;
};

/** "Madi-Okollo", "madi okollo" and "Madi Okollo" are one place. */
export function normalizePlaceName(name: string): string {
    return name.toLowerCase().replace(/[\s\-_]+/g, '');
}

/** Other headers the team uses for a column. */
const HEADER_ALIASES: Record<string, string[]> = {
    programPotential: ['potential'],
};

function readSheet<S extends z.ZodObject>(
    sheet: string,
    rows: SheetRow[] | null,
    schema: S,
): Result<{ row: number; value: z.infer<S> }[], CoverageRowError[]> {
    if (!rows) return err([{ sheet, row: null, message: 'Sheet is missing' }]);
    const [header, ...body] = rows;
    if (!header) return err([{ sheet, row: null, message: 'Sheet is empty' }]);

    // Columns are found by header name, ignoring case and spaces ("Program
    // Potential" is programPotential), so order and extra columns don't matter.
    const names = header.cells.map(cell =>
        typeof cell === 'string'
            ? cell.replace(/\s+/g, '').toLowerCase()
            : null,
    );
    const columns = Object.keys(schema.shape).map(key => ({
        key,
        index: names.findIndex(
            name =>
                name !== null &&
                [key, ...(HEADER_ALIASES[key] ?? [])].some(
                    accepted => accepted.toLowerCase() === name,
                ),
        ),
    }));
    const missing = columns.filter(
        ({ key, index }) =>
            index === -1 && !schema.shape[key].safeParse(undefined).success,
    );
    if (missing.length > 0) {
        return err([
            {
                sheet,
                row: header.row,
                message: `Missing column ${missing.map(c => c.key).join(', ')}`,
            },
        ]);
    }

    const values: { row: number; value: z.infer<S> }[] = [];
    const errors: CoverageRowError[] = [];
    for (const { row, cells } of body) {
        const raw = Object.fromEntries(
            columns.map(({ key, index }) => [key, cells[index] ?? undefined]),
        );
        if (Object.values(raw).every(value => value === undefined)) continue;

        const parsed = schema.safeParse(raw);
        if (parsed.success) values.push({ row, value: parsed.data });
        else
            errors.push({
                sheet,
                row,
                message: parsed.error.issues
                    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
                    .join('; '),
            });
    }
    return errors.length > 0 ? err(errors) : ok(values);
}

/** A sheet with one row per Program and month; a missing sheet has none. */
function readMonthly<S extends z.ZodObject>(
    sheet: string,
    rows: SheetRow[] | null,
    schema: S,
): Result<{ row: number; value: z.infer<S> }[], CoverageRowError[]> {
    if (!rows) return ok([]);
    const read = readSheet(sheet, rows, schema);
    if (!read.ok) return read;
    const seen = new Set<string>();
    const errors: CoverageRowError[] = [];
    for (const { row, value } of read.data) {
        const key = `${value.programId}:${value.month}`;
        if (seen.has(key))
            errors.push({
                sheet,
                row,
                message: `Program ${value.programId} has more than one row for ${value.month}`,
            });
        seen.add(key);
    }
    return errors.length > 0 ? err(errors) : read;
}

/** A sheet with one row per Program; a missing sheet has none. */
function readPerProgram<
    S extends z.ZodObject<{ programId: typeof programIdSchema }>,
>(
    sheet: string,
    rows: SheetRow[] | null,
    schema: S,
): Result<{ row: number; value: z.infer<S> }[], CoverageRowError[]> {
    if (!rows) return ok([]);
    const read = readSheet(sheet, rows, schema);
    if (!read.ok) return read;
    const seen = new Set<number>();
    const errors: CoverageRowError[] = [];
    for (const { row, value } of read.data) {
        if (seen.has(value.programId))
            errors.push({
                sheet,
                row,
                message: `Program ${value.programId} has more than one row`,
            });
        seen.add(value.programId);
    }
    return errors.length > 0 ? err(errors) : read;
}

/**
 * Reads the team's coverage workbook: one row per Coverage Unit, and
 * (optionally) Expected Users, one row per Program and month, and Program
 * Potential, one row per Program. Other sheets are ignored. Fails on any invalid or duplicate row, so
 * a half-read workbook never reaches the page.
 */
export function parseCoverageSheets(
    sheets: CoverageSheets,
): Result<CoverageFigures, CoverageRowError[]> {
    const units = readSheet(UNITS_SHEET, sheets.units, coverageUnitRowSchema);
    const expectedUsers = readMonthly(
        EXPECTED_USERS_SHEET,
        sheets.expectedUsers,
        expectedUsersRowSchema,
    );
    const programPotential = readPerProgram(
        PROGRAM_POTENTIAL_SHEET,
        sheets.programPotential,
        programPotentialRowSchema,
    );
    const projectedDevices = readMonthly(
        PROJECTED_DEVICES_SHEET,
        sheets.projectedDevices ?? null,
        projectedDevicesRowSchema,
    );
    const errors = [
        ...(units.ok ? [] : units.error),
        ...(expectedUsers.ok ? [] : expectedUsers.error),
        ...(programPotential.ok ? [] : programPotential.error),
        ...(projectedDevices.ok ? [] : projectedDevices.error),
    ];
    if (
        !units.ok ||
        !expectedUsers.ok ||
        !programPotential.ok ||
        !projectedDevices.ok
    )
        return err(errors);

    const seenUnits = new Set<string>();
    for (const { row, value } of units.data) {
        const key = `${value.programId}:${normalizePlaceName(value.unit)}`;
        if (seenUnits.has(key))
            errors.push({
                sheet: UNITS_SHEET,
                row,
                message: `${value.unit} is listed twice for Program ${value.programId}`,
            });
        seenUnits.add(key);
    }
    if (errors.length > 0) return err(errors);

    return ok({
        units: units.data.map(({ value }) => value),
        expectedUsers: expectedUsers.data.map(({ value }) => value),
        programPotential: programPotential.data.map(({ value }) => value),
        projectedDevices: projectedDevices.data.map(({ value }) => value),
    });
}

/** "Units row 5: status: Invalid option" for the page and logs. */
export function describeCoverageError(error: CoverageRowError): string {
    const where =
        error.row === null ? error.sheet : `${error.sheet} row ${error.row}`;
    return `${where}: ${error.message}`;
}
