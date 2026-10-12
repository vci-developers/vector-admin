import { getProgress } from '@/api/progress/get-progress';
import { getProgressQuerySchema } from '@/api/progress/validation/progress-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
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
                message: 'Invalid progress query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(viewer => getProgress(query.data, viewer));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
