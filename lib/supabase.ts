import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Booking } from './types';
import { INITIAL_DEMO_BOOKINGS } from './constants';

const LOCAL_STORAGE_KEY = 'pogh_bookings_cache';
const SUPABASE_CONFIG_KEY = 'pogh_supabase_config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.anonKey) return parsed;
      } catch (e) {
        console.error('Failed to parse saved Supabase config', e);
      }
    }
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  }
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey && cfg.url.startsWith('https://'));
}

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (cfg.url && cfg.anonKey && cfg.url.startsWith('https://')) {
    try {
      return createClient(cfg.url, cfg.anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    } catch (err) {
      console.error('Error creating Supabase client:', err);
    }
  }
  return null;
}

// ── Local Storage Fallback Engine (when Supabase credentials are not yet supplied) ──
export function getLocalBookings(): Booking[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_BOOKINGS;
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_BOOKINGS));
    return INITIAL_DEMO_BOOKINGS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_DEMO_BOOKINGS;
  }
}

export function saveLocalBookings(bookings: Booking[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookings));
  }
}
