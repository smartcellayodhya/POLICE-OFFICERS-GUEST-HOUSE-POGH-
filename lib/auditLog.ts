export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  user: string; // username or display name
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'LOGIN' | 'MAINTENANCE';
  title: string;
  details: string;
}

const STORAGE_KEY = 'pogh_activity_logs';

export function getActivityLogs(): ActivityLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logActivity(
  action: ActivityLog['action'],
  title: string,
  details: string,
  user: string = 'Admin'
) {
  if (typeof window === 'undefined') return;
  try {
    const current = getActivityLogs();
    const newEntry: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      title,
      details,
    };
    // Keep latest 200 logs
    const updated = [newEntry, ...current].slice(0, 200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save activity log:', e);
  }
}

export function clearActivityLogs() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
