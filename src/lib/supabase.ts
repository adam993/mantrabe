import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The cloud sync layer is OPTIONAL. If env vars aren't set, the app still
// works fully — local storage stays the source of truth. We expose `supabase`
// as `null` in that case so callers can no-op the sync paths cleanly.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_ENABLED = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = SUPABASE_ENABLED
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
