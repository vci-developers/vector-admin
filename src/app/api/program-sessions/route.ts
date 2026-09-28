import { getProgramSessions } from '@/api/program-sessions/get-program-sessions';
import { getProgramSessionsQuerySchema } from '@/api/program-sessions/validation/program-sessions-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getProgramSessionsQuerySchema.safeParse(
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

    const result = await withViewer(() => getProgramSessions(query.data));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
