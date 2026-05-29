// Denylist — the source of truth for revocation.
//
// A key on the denylist is rejected on the next online check (activate/refresh/
// status) regardless of the license row's status. This is defense in depth: even
// if a status update is missed, the denylist still blocks the key. Offline tokens
// already issued keep working until their exp — that's the intended tradeoff
// (the customer gets revoked at next refresh, within the TTL window).

import { supabase } from './db.ts';

export async function isDenied(licenseKey: string): Promise<{ denied: boolean; reason?: string }> {
  const { data } = await supabase
    .from('denylist')
    .select('reason')
    .eq('license_key', licenseKey)
    .maybeSingle();
  if (data) return { denied: true, reason: data.reason ?? undefined };
  return { denied: false };
}

export async function addToDenylist(licenseKey: string, reason: string): Promise<void> {
  // Upsert so re-revoking an already-denied key doesn't error on the PK.
  const { error } = await supabase
    .from('denylist')
    .upsert({ license_key: licenseKey, reason }, { onConflict: 'license_key' });
  if (error) throw error;
}

export async function removeFromDenylist(licenseKey: string): Promise<void> {
  const { error } = await supabase.from('denylist').delete().eq('license_key', licenseKey);
  if (error) throw error;
}
