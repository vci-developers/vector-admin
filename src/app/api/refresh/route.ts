import { PROGRAMS_TAG } from '@/api/admin/load-programs';
import { programSnapshotTag } from '@/api/admin/load-program-snapshot';
import { COVERAGE_TAG } from '@/api/coverage/load-coverage';
import { withDeveloper } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const programIdsSchema = z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform(value => value.split(',').map(Number));

export async function POST(request: NextRequest) {
    const programIds = programIdsSchema.safeParse(
        request.nextUrl.searchParams.get('programIds'),
    );
    if (!programIds.success) {
        return NextResponse.json(
            err({ kind: 'client', status: 400, message: 'Invalid programIds' }),
            { status: 400 },
        );
    }

    const result = await withDeveloper(async () => {
        // expire: 0 so the next load refetches instead of serving stale data
        revalidateTag(PROGRAMS_TAG, { expire: 0 });
        revalidateTag(COVERAGE_TAG, { expire: 0 });
        programIds.data.forEach(id =>
            revalidateTag(programSnapshotTag(id), { expire: 0 }),
        );
        return ok(null);
    });

    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
