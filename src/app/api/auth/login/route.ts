import { login } from '@/api/auth/login';
import { setAccessCookie } from '@/lib/auth-session/cookies';
import { viewerForToken } from '@/lib/auth-session/with-viewer';
import { err, ok } from '@/lib/result/result';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const requestBody: unknown = await request.json().catch(() => undefined);
    if (requestBody === undefined) {
        return NextResponse.json(
            err({ kind: 'client', status: 400, message: 'Invalid JSON body' }),
            { status: 400 },
        );
    }

    const loginResult = await login(requestBody);
    if (!loginResult.ok) {
        return NextResponse.json(loginResult, {
            status: loginResult.error.status ?? 400,
        });
    }

    // A right password is not entry: say now if the account can't use
    // VectorAdmin, rather than letting it into an empty dashboard.
    const accessToken = loginResult.data.tokens.accessToken;
    const viewer = await viewerForToken(accessToken);
    if (!viewer.ok) {
        return NextResponse.json(viewer, {
            status: viewer.error.status ?? 403,
        });
    }

    const response = NextResponse.json(ok(null), { status: 200 });
    setAccessCookie(response, accessToken);
    return response;
}
