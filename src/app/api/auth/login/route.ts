import { login } from '@/api/auth/login';
import { setAccessCookie } from '@/lib/auth-session/cookies';
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

    const response = NextResponse.json(ok(null), { status: 200 });
    setAccessCookie(response, loginResult.data.tokens.accessToken);
    return response;
}
