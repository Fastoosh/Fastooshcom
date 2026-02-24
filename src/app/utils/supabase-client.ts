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
    );
  }
  return window.__supabaseClient;
}
