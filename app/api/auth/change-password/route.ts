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
    const { currentPassword, newPassword, targetUsername } = body;

    const cleanTarget = (targetUsername || user.username).trim().toLowerCase();
    const isAdminResettingOther = user.role === 'admin' && cleanTarget !== user.username.toLowerCase();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'नया पासवर्ड न्यूनतम 6 अक्षरों का होना चाहिए (Minimum 6 characters)' },
        { status: 400 }
      );
    }

    if (isAdminResettingOther) {
      // Admin is authorized to reset other staff accounts
      const allowedUsers = ['operator', 'officer', 'admin'];
      if (!allowedUsers.includes(cleanTarget)) {
        return NextResponse.json(
          { success: false, error: 'अमान्य खाता (Invalid target username)' },
          { status: 400 }
        );
      }

      await updateServerPassword(cleanTarget, newPassword);
      return NextResponse.json({
        success: true,
        message: `Password for ${cleanTarget} updated successfully on server`,
      });
    }

    // Normal user or admin updating their own password: verify existing password
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'वर्तमान पासवर्ड आवश्यक है (Current password is required)' },
        { status: 400 }
      );
    }

    const verified = await verifyServerCredentials(user.username, currentPassword);
    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'वर्तमान पासवर्ड गलत है (Incorrect current password)' },
        { status: 400 }
      );
    }

    await updateServerPassword(user.username, newPassword);

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
