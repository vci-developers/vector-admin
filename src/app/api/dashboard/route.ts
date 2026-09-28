import { getDashboard } from '@/api/dashboard/get-dashboard';
import { getDashboardQuerySchema } from '@/api/dashboard/validation/dashboard-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getDashboardQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid dashboard query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(() => getDashboard(query.data));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
