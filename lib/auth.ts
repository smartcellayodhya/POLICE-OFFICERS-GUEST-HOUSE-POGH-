import { sha256 } from './crypto';

export type UserRole = 'admin' | 'officer' | 'operator';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  badgeTitle: string;
}

const PWD_SALT = 'pogh_up_police_ayodhya_2026_salt';
const SESSION_SECRET = 'pogh_session_sig_up_police_2026';
const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

export function hashPassword(plain: string): string {
  return sha256(`${PWD_SALT}:${plain}`);
}

export const PRESET_ACCOUNTS = [
  {
    username: 'admin',
    passwordHash: hashPassword('admin@pogh2026'),
    displayName: 'SSP Office',
    role: 'admin' as UserRole,
    badgeTitle: 'प्रशासनिक नियंत्रण (Full Control)',
  },
  {
    username: 'operator',
    passwordHash: hashPassword('operator@2026'),
    displayName: 'Guest House Operator',
    role: 'operator' as UserRole,
    badgeTitle: 'काउंटर ऑपरेटर (Collection & Billing)',
  },
  {
    username: 'officer',
    passwordHash: hashPassword('officer@2026'),
    displayName: 'Duty Officer',
    role: 'officer' as UserRole,
    badgeTitle: 'अधिकारी दृश्य (Reports & Occupancy Only)',
  },
];

const AUTH_STORAGE_KEY_V2 = 'pogh_session_v2';
const LEGACY_AUTH_STORAGE_KEY = 'pogh_current_user';
const CUSTOM_CREDS_KEY = 'pogh_custom_credentials';

interface StoredSession {
  user: AuthUser;
  issuedAt: number;
  sig: string;
}

function computeSessionSig(user: AuthUser, issuedAt: number): string {
  return sha256(`${user.id}:${user.username}:${user.role}:${issuedAt}:${SESSION_SECRET}`);
}

export function getLoggedInUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;

  // 1. Check v2 cryptographically signed session
  const stored = localStorage.getItem(AUTH_STORAGE_KEY_V2);
  if (stored) {
    try {
      const session: StoredSession = JSON.parse(stored);
      const { user, issuedAt, sig } = session;

      // Validate role integrity
      if (!user || !['admin', 'operator', 'officer'].includes(user.role)) {
        logoutUser();
        return null;
      }

      // Detect DevTools privilege escalation / tampering
      const expectedSig = computeSessionSig(user, issuedAt);
      if (sig !== expectedSig) {
        console.warn('Security Alert: Session signature mismatch. Session has been revoked.');
        logoutUser();
        return null;
      }

      // Check max session expiration (24h)
      if (Date.now() - issuedAt > MAX_SESSION_DURATION_MS) {
        logoutUser();
        return null;
      }

      // Display name normalization
      if (user.displayName === 'SSP Office / Admin In-Charge') {
        user.displayName = 'SSP Office';
        setLoggedInUser(user);
      } else if (user.displayName === 'Duty Officer / Ayodhya Police') {
        user.displayName = 'Duty Officer';
        setLoggedInUser(user);
      }

      return user;
    } catch {
      logoutUser();
      return null;
    }
  }

  // 2. Backward compatibility migration from unhashed session
  const legacyStored = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
  if (legacyStored) {
    try {
      const user: AuthUser = JSON.parse(legacyStored);
      if (user && ['admin', 'operator', 'officer'].includes(user.role)) {
        setLoggedInUser(user);
        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
        return user;
      }
    } catch {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    }
  }

  return null;
}

const AUTH_TOKEN_KEY = 'pogh_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function setLoggedInUser(user: AuthUser | null, token?: string) {
  if (typeof window === 'undefined') return;
  if (user) {
    const issuedAt = Date.now();
    const session: StoredSession = {
      user,
      issuedAt,
      sig: computeSessionSig(user, issuedAt),
    };
    localStorage.setItem(AUTH_STORAGE_KEY_V2, JSON.stringify(session));
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    localStorage.setItem('pogh_last_activity', Date.now().toString());
    if (token) {
      setAuthToken(token);
    }
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY_V2);
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    localStorage.removeItem('pogh_last_activity');
    setAuthToken(null);
  }
}

export function logoutUser() {
  setLoggedInUser(null);
  setAuthToken(null);
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
  }
}

export function getCustomCredentials(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_CREDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function changeUserPassword(username: string, oldPass: string, newPass: string): { success: boolean; message: string } {
  const cleanUser = username.trim().toLowerCase();
  const custom = getCustomCredentials();
  const preset = PRESET_ACCOUNTS.find((a) => a.username.toLowerCase() === cleanUser);
  
  if (!preset) {
    return { success: false, message: 'उपयोगकर्ता नहीं मिला।' };
  }

  const storedCred = custom[cleanUser];
  const oldPassHashed = hashPassword(oldPass);
  const isValidOldPass = storedCred
    ? storedCred === oldPassHashed || storedCred === oldPass
    : preset.passwordHash === oldPassHashed;

  if (!isValidOldPass) {
    return { success: false, message: 'वर्तमान पासवर्ड अमान्य है।' };
  }

  if (newPass.length < 6) {
    return { success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' };
  }

  // Save cryptographically hashed password
  custom[cleanUser] = hashPassword(newPass);
  localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(custom));
  return { success: true, message: 'पासवर्ड सफलतापूर्वक बदल दिया गया।' };
}

export function adminResetUserPassword(targetUsername: string, newPass: string): { success: boolean; message: string } {
  const cleanUser = targetUsername.trim().toLowerCase();
  const custom = getCustomCredentials();
  const preset = PRESET_ACCOUNTS.find((a) => a.username.toLowerCase() === cleanUser);
  
  if (!preset) {
    return { success: false, message: 'उपयोगकर्ता नहीं मिला।' };
  }

  if (newPass.length < 6) {
    return { success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' };
  }

  // Save cryptographically hashed password
  custom[cleanUser] = hashPassword(newPass);
  localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(custom));
  return { success: true, message: 'पासवर्ड सफलतापूर्वक अपडेट कर दिया गया।' };
}

export function authenticate(username: string, password: string): AuthUser | null {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();
  const passHash = hashPassword(cleanPass);
  const custom = getCustomCredentials();

  const found = PRESET_ACCOUNTS.find((acc) => {
    if (acc.username.toLowerCase() !== cleanUser) return false;
    const storedCred = custom[cleanUser];
    if (storedCred) {
      // Matches either hash or legacy plain text
      return storedCred === passHash || storedCred === cleanPass;
    }
    return acc.passwordHash === passHash;
  });

  if (found) {
    // If user previously had a cleartext password in storage, automatically migrate to hash
    if (custom[cleanUser] && custom[cleanUser] === cleanPass) {
      custom[cleanUser] = passHash;
      localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(custom));
    }

    const authUser: AuthUser = {
      id: found.username,
      username: found.username,
      displayName: found.displayName,
      role: found.role,
      badgeTitle: found.badgeTitle,
    };
    setLoggedInUser(authUser);
    return authUser;
  }
  return null;
}


