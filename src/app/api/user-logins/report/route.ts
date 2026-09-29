import { getUserLogins } from '@/api/user-logins/get-user-logins';
import { getUserLoginsQuerySchema } from '@/api/user-logins/validation/user-logins-schema';
import { buildLoginReportSheets } from '@/features/dashboard/utils/build-user-logins';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
import ExcelJS from 'exceljs';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getUserLoginsQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid report query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(async () => {
        const logins = await getUserLogins(query.data);
        if (!logins.ok) return logins;
        // A partial selection must not download as if it were complete.
        if (logins.data.failedProgramIds.length > 0) {
            return err({
                kind: 'server' as const,
                status: 502,
                message: 'Some Programs failed to load',
            });
        }
        const sheets = buildLoginReportSheets(
            logins.data.users,
            query.data,
            logins.data.programNames,
        );
        const workbook = new ExcelJS.Workbook();
        for (const [name, rows] of [
            ['unique-users', sheets.uniqueUsers],
            ['daily-logins', sheets.dailyLogins],
        ] as const) {
            const sheet = workbook.addWorksheet(name);
            sheet.addRows(rows);
            sheet.getRow(1).font = { bold: true };
        }
        return ok(await workbook.xlsx.writeBuffer());
    });

    if (!result.ok) {
        return NextResponse.json(result, {
            status: result.error.status ?? 500,
        });
    }
    const { from, to } = query.data;
    return new NextResponse(result.data, {
        headers: {
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="user-logins-${from}_${to}.xlsx"`,
        },
    });
}
