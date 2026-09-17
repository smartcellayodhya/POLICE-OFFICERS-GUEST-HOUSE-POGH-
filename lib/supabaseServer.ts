import { createClient, SupabaseClient } from '@supabase/supabase-js';

let serverClientInstance: SupabaseClient | null = null;

export function getServerSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  // Prioritize server-only service role key if available, otherwise anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key || !url.startsWith('https://')) {
    return null;
  }

  if (!serverClientInstance) {
    serverClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClientInstance;
}
