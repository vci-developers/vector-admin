import { clearAccessCookie } from '@/lib/auth-session/cookies';
import { NextResponse } from 'next/server';

// GET so the layout can redirect here when a present cookie holds an expired token
export async function GET(request: Request) {
    const loginUrl = new URL('/login', request.url);
    // Why the session ended, shown on the login page; capped, as it's echoed.
    const reason = new URL(request.url).searchParams
        .get('reason')
        ?.slice(0, 200);
    if (reason) loginUrl.searchParams.set('reason', reason);
    const response = NextResponse.redirect(loginUrl);
    clearAccessCookie(response);
    return response;
}
