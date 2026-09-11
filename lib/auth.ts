export type UserRole = 'admin' | 'officer';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  badgeTitle: string;
}

export const PRESET_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin@pogh2026',
    displayName: 'SSP Office / Admin In-Charge',
    role: 'admin' as UserRole,
    badgeTitle: 'प्रशासनिक नियंत्रण (Full Control)',
  },
  {
    username: 'officer',
    password: 'officer@2026',
    displayName: 'Duty Officer / Ayodhya Police',
    role: 'officer' as UserRole,
    badgeTitle: 'अधिकारी दृश्य (Reports & Occupancy Only)',
  },
];

const AUTH_STORAGE_KEY = 'pogh_current_user';

export function getLoggedInUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setLoggedInUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

const CUSTOM_CREDS_KEY = 'pogh_custom_credentials';

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

  const currentValidPass = custom[cleanUser] || preset.password;
  if (oldPass !== currentValidPass) {
    return { success: false, message: 'पुराना पासवर्ड अमान्य है।' };
  }

  if (newPass.length < 6) {
    return { success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' };
  }

  custom[cleanUser] = newPass;
  localStorage.setItem(CUSTOM_CREDS_KEY, JSON.stringify(custom));
  return { success: true, message: 'पासवर्ड सफलतापूर्वक बदल दिया गया।' };
}

export function authenticate(username: string, password: string): AuthUser | null {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();
  const custom = getCustomCredentials();

  const found = PRESET_ACCOUNTS.find(
    (acc) => {
      const activePassword = custom[acc.username.toLowerCase()] || acc.password;
      return acc.username.toLowerCase() === cleanUser && activePassword === cleanPass;
    }
  );

  if (found) {
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

export function logoutUser() {
  setLoggedInUser(null);
}

