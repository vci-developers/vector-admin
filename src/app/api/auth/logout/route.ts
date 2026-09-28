import { clearAccessCookie } from '@/lib/auth-session/cookies';
import { NextResponse } from 'next/server';

// GET so the layout can redirect here when a present cookie holds an expired token
export async function GET(request: Request) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    clearAccessCookie(response);
    return response;
}
