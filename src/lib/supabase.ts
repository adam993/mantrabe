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
        // The default 'pkce' flow binds the email's 6-digit {{ .Token }}
        // to a code_verifier stored in the originating browser context.
        // That breaks two flows we care about:
        //   1. iOS PWA: the magic link opens Safari, which has no access
        //      to the PWA's localStorage, so the verifier is missing and
        //      verifyOtp returns the generic "Token has expired or is
        //      invalid" — even with a fresh code.
        //   2. Native: the deep-link handler in lib/auth.tsx pulls tokens
        //      out of the URL fragment, which is the implicit pattern.
        // Implicit flow makes the 6-digit OTP independently verifiable
        // and keeps the magic-link paths working unchanged.
        flowType: 'implicit',
      },
    })
  : null;
