import { loadCoverage } from '@/api/coverage/load-coverage';
import { getProgressReportData } from '@/api/progress/get-progress';
import { getProgressQuerySchema } from '@/api/progress/validation/progress-schema';
import { buildProgressReport } from '@/features/dashboard/utils/build-progress-report';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getProgressQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid progress report query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(async viewer => {
        const [report, coverage] = await Promise.all([
            getProgressReportData(query.data, viewer),
            loadCoverage(true),
        ]);
        if (!report.ok) return report;
        const { progress, internalMetrics } = report.data;
        if (progress.failedProgramIds.length > 0) {
            return err({
                kind: 'server' as const,
                status: 502,
                message:
                    'Some selected programs failed to load. Try again before exporting.',
            });
        }
        const workbook = buildProgressReport(
            progress,
            coverage.ok ? coverage.data : null,
            Date.now(),
            internalMetrics,
        );
        return ok({
            file: await workbook.xlsx.writeBuffer(),
            from: progress.from,
            to: progress.to,
        });
    });

    if (!result.ok) {
        return NextResponse.json(result, {
            status: result.error.status ?? 500,
        });
    }
    return new NextResponse(result.data.file, {
        headers: {
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="vectorcam-progress-${result.data.from}_${result.data.to}.xlsx"`,
            'Cache-Control': 'private, no-store',
        },
    });
}
