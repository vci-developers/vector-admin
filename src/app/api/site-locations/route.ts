import { getSiteLocations } from '@/api/site-locations/get-site-locations';
import { getSiteLocationsQuerySchema } from '@/api/site-locations/validation/site-locations-schema';
import { withViewer } from '@/lib/auth-session/with-viewer';
import { err } from '@/lib/result/result';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const query = getSiteLocationsQuerySchema.safeParse(
        Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
        return NextResponse.json(
            err({
                kind: 'client',
                status: 400,
                message: 'Invalid site locations query',
            }),
            { status: 400 },
        );
    }

    const result = await withViewer(() => getSiteLocations(query.data));
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
