import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'chatroom-66981';
const issuer = `https://securetoken.google.com/${projectId}`;
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const SESSION_COOKIE_NAME = 'firebaseSession';

async function verifyFirebaseToken(token: string) {
  return jwtVerify(token, JWKS, {
    issuer,
    audience: projectId,
  });
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  const redirectTarget = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set('redirect', redirectTarget);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const { payload } = await verifyFirebaseToken(token);
    const role = payload.role as string | undefined;

    const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
    const isConfederatePath = request.nextUrl.pathname.startsWith('/confederate');

    if (isAdminPath && role !== 'admin') {
      return redirectToLogin(request);
    }

    if (isConfederatePath && role !== 'admin' && role !== 'confederate') {
      return redirectToLogin(request);
    }

    const requestHeaders = new Headers(request.headers);
    if (role) {
      requestHeaders.set('x-user-role', role);
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (error) {
    console.error('Auth middleware verification failed', error);
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/confederate/:path*'],
};
