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

export function authenticate(username: string, password: string): AuthUser | null {
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  const found = PRESET_ACCOUNTS.find(
    (acc) => acc.username.toLowerCase() === cleanUser && acc.password === cleanPass
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
