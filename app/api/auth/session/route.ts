import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/firebaseAdmin';

const SESSION_COOKIE_NAME = 'firebaseSession';
const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);

    const response = NextResponse.json({
      ok: true,
      uid: decodedToken.uid,
      role: decodedToken.role ?? null,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: idToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });

  return response;
}
