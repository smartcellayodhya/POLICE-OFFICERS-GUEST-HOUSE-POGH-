import { NextRequest, NextResponse } from 'next/server';
import { verifyServerCredentials, createSessionToken, setAuthCookie } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await verifyServerCredentials(username, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'अमान्य क्रेडेंशियल (Invalid username or password)' },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);
    const response = NextResponse.json({
      success: true,
      user,
      token, // Also returned for client-side API/offline fallback storage
    });

    // Set secure httpOnly cookie
    return setAuthCookie(response, token);
  } catch (err: any) {
    console.error('Login route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
