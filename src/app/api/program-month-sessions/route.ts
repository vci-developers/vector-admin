import { getProgramMonthSessions } from '@/api/program-month-sessions/get-program-month-sessions';
import { getProgramMonthSessionsQuerySchema } from '@/api/program-month-sessions/validation/program-month-sessions-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getProgramMonthSessionsQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid sessions query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(() => getProgramMonthSessions(query.data));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
