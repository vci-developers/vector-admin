import 'server-only';

import type { NextResponse } from 'next/server';

export const ACCESS_COOKIE_NAME = 'accessToken';

const ACCESS_TOKEN_TTL = 24 * 60 * 60;

export function setAccessCookie(response: NextResponse, accessToken: string) {
    const maxAge = Math.max(0, ACCESS_TOKEN_TTL - 60); // Subtract 60 seconds to account for potential delays

    response.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    });
}

export function clearAccessCookie(response: NextResponse) {
    response.cookies.delete(ACCESS_COOKIE_NAME);
}
