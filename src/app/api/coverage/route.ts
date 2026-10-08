import { getCoverage } from '@/api/coverage/get-coverage';
import { getCoverageQuerySchema } from '@/api/coverage/validation/coverage-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getCoverageQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid coverage query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(viewer => getCoverage(query.data, viewer));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
