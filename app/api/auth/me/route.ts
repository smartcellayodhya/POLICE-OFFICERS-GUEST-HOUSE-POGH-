import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized or session expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
