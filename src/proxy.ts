import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE_NAME } from '@/lib/auth-session/cookies';

const PUBLIC_ROUTES = new Set(['/login']);

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const accessToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
    const isPublic = PUBLIC_ROUTES.has(pathname);

    if (!accessToken) {
        if (isPublic) return NextResponse.next();
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set(
            'redirect',
            request.nextUrl.pathname + request.nextUrl.search,
        );
        return NextResponse.redirect(loginUrl);
    }

    if (isPublic) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Icons and images are public, so the sign-in page shows its logo and the
    // tab its icon before anyone signs in.
    matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:ico|png)$).*)'],
};
