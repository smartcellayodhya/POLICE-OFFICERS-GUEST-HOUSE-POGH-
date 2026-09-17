import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, verifyServerCredentials, updateServerPassword } from '@/lib/serverAuth';

export async function POST(req: NextRequest) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please login again.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current and new passwords are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'नया पासवर्ड न्यूनतम 6 अक्षरों का होना चाहिए (Minimum 6 characters)' },
        { status: 400 }
      );
    }

    // Verify existing password
    const verified = verifyServerCredentials(user.username, currentPassword);
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'वर्तमान पासवर्ड गलत है (Incorrect current password)' },
        { status: 400 }
      );
    }

    // Update password
    updateServerPassword(user.username, newPassword);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully on server',
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while changing password' },
      { status: 500 }
    );
  }
}
