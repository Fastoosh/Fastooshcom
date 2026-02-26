import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

type SupabaseClient = ReturnType<typeof createClient>;

declare global {
  interface Window { __supabaseClient?: SupabaseClient }
}

export function getSupabaseClient(): SupabaseClient {
  if (!window.__supabaseClient) {
    window.__supabaseClient = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          // PKCE is the most secure OAuth flow — code is exchanged explicitly in /auth/callback
          flowType: 'pkce',
          // Disabled so the singleton never auto-exchanges the ?code= param;
          // AuthCallback and ResetPassword do the exchange explicitly — no race condition.
          detectSessionInUrl: false,
          // Persist session in localStorage so the user stays signed in across tabs
          persistSession: true,
        },
      },
    );
  }
  return window.__supabaseClient;
}