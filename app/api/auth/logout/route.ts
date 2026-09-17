import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });
  return clearAuthCookie(response);
}
