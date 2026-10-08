import { getUserLogins } from '@/api/user-logins/get-user-logins';
import { getUserLoginsQuerySchema } from '@/api/user-logins/validation/user-logins-schema';
import { withDeveloper } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
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
                message: 'Invalid user logins query',
            }),
            { status: 400 },
        );
    }

    const result = await withDeveloper(async () => {
        const logins = await getUserLogins(query.data);
        if (!logins.ok) return logins;
        const { users, failedProgramIds } = logins.data;
        return ok({ users, failedProgramIds });
    });
    return NextResponse.json(result, {
        status: result.ok ? 200 : (result.error.status ?? 500),
    });
}
