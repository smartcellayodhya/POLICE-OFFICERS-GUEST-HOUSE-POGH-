import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AuthUser, UserRole } from './auth';

const SERVER_SESSION_SECRET = process.env.SESSION_SECRET || 'pogh_up_police_server_secret_key_ayodhya_2026_x7a';
const SERVER_PWD_SALT = 'pogh_up_police_ayodhya_2026_salt';
export const AUTH_COOKIE_NAME = 'pogh_auth_session';
const SESSION_MAX_AGE_SEC = 24 * 60 * 60; // 24 Hours

export function serverHashPassword(plain: string): string {
  return crypto
    .createHash('sha256')
    .update(`${SERVER_PWD_SALT}:${plain}`)
    .digest('hex');
}

// In-memory or fallback account credentials
// (Can also be overridden by env variables)
const SERVER_PRESET_ACCOUNTS = [
  {
    id: 'user-admin-01',
    username: 'admin',
    passwordHash: serverHashPassword('admin@pogh2026'),
    displayName: 'SSP Office',
    role: 'admin' as UserRole,
    badgeTitle: 'प्रशासनिक नियंत्रण (Full Control)',
  },
  {
    id: 'user-operator-01',
    username: 'operator',
    passwordHash: serverHashPassword('operator@2026'),
    displayName: 'Guest House Operator',
    role: 'operator' as UserRole,
    badgeTitle: 'काउंटर ऑपरेटर (Collection & Billing)',
  },
  {
    id: 'user-officer-01',
    username: 'officer',
    passwordHash: serverHashPassword('officer@2026'),
    displayName: 'Duty Officer',
    role: 'officer' as UserRole,
    badgeTitle: 'अधिकारी दृश्य (Reports & Occupancy Only)',
  },
];

// In-memory store for custom password updates on running server instance
const customPasswordStore = new Map<string, string>();

export function verifyServerCredentials(username: string, plainPassword: string): AuthUser | null {
  const cleanUser = (username || '').trim().toLowerCase();
  const account = SERVER_PRESET_ACCOUNTS.find((a) => a.username.toLowerCase() === cleanUser);
  if (!account) return null;

  const inputHash = serverHashPassword(plainPassword);
  const activeHash = customPasswordStore.get(account.username) || account.passwordHash;

  // Constant-time comparison to prevent timing attacks
  const aBuf = Buffer.from(inputHash);
  const bBuf = Buffer.from(activeHash);
  if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
    return null;
  }

  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    badgeTitle: account.badgeTitle,
  };
}

export function updateServerPassword(username: string, newPasswordPlain: string): boolean {
  const cleanUser = (username || '').trim().toLowerCase();
  const account = SERVER_PRESET_ACCOUNTS.find((a) => a.username.toLowerCase() === cleanUser);
  if (!account) return false;

  const newHash = serverHashPassword(newPasswordPlain);
  customPasswordStore.set(account.username, newHash);
  return true;
}

export interface SessionTokenPayload {
  user: AuthUser;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a cryptographically signed HMAC SHA-256 session token.
 * Token format: Base64Url(payload) + '.' + Base64Url(HMAC(Base64Url(payload)))
 */
export function createSessionToken(user: AuthUser): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    user,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SEC * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the session token signature and validity.
 */
export function verifySessionToken(token: string): AuthUser | null {
  if (!token || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', SERVER_SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload: SessionTokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }
    return payload.user;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the authenticated user from the request.
 * Checks httpOnly cookie first, then Authorization Bearer header.
 */
export function getAuthenticatedUser(req: NextRequest): AuthUser | null {
  // 1. Try cookie
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (cookie && cookie.value) {
    const user = verifySessionToken(cookie.value);
    if (user) return user;
  }

  // 2. Try Authorization header (Bearer <token>)
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  return null;
}

/**
 * Helper to generate response with secure httpOnly cookie.
 */
export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

/**
 * Helper to clear auth cookie on logout.
 */
export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
