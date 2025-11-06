import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth } from '@/firebaseAdmin';

const SESSION_COOKIE_NAME = 'firebaseSession';
const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken, true);

    cookies().set({
      name: SESSION_COOKIE_NAME,
      value: idToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      ok: true,
      uid: decodedToken.uid,
      role: decodedToken.role ?? null,
    });
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}

export async function DELETE() {
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
