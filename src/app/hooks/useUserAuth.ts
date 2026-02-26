import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../utils/supabase-client';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { User, Session, Provider } from '@supabase/supabase-js';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Password reset lands here; must be in Supabase → Auth → Redirect URLs allowlist.
const RESET_REDIRECT = 'https://www.fastoosh.com/auth/reset-password';

// Redirect URL for OAuth callbacks — works in dev and production
const OAUTH_REDIRECT = `${window.location.origin}/auth/callback`;

export interface UserAuth {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail:   (email: string, password: string) => Promise<void>;
  signUpWithEmail:   (email: string, password: string, name?: string) => Promise<void>;
  signInWithOAuth:   (provider: 'google' | 'discord') => Promise<void>;
  forgotPassword:    (email: string) => Promise<void>;
  updatePassword:    (newPassword: string) => Promise<void>;
  updateEmail:       (newEmail: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useUserAuth(): UserAuth {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  /* ── Email / password ───────────────────────────────────────────────────── */

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    name?: string,
  ) => {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, password, fullName: name || '' }),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Failed to create account');

    const supabase = getSupabaseClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) throw new Error(loginError.message);
  }, []);

  /* ── OAuth (Google, Discord) ─────────────────────────────────────────────── */

  const signInWithOAuth = useCallback(async (provider: 'google' | 'discord') => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // PKCE: Supabase sends ?code= to this URL; AuthCallback exchanges it
        redirectTo: OAUTH_REDIRECT,
        // Do NOT pass custom scopes — let Supabase use its built-in defaults for each provider
      },
    });
    if (error) throw new Error(error.message);
    // signInWithOAuth triggers a full-page redirect — nothing executes after this
  }, []);

  /* ── Forgot / reset password ────────────────────────────────────────────── */

  const forgotPassword = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }, []);

  /* ── Email change ───────────────────────────────────────────────────────── */

  const updateEmail = useCallback(async (newEmail: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message);
  }, []);

  /* ── Sign out ───────────────────────────────────────────────────────────── */

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  }, []);

  return {
    user, session, loading,
    signInWithEmail, signUpWithEmail, signInWithOAuth,
    forgotPassword, updatePassword, updateEmail,
    signOut,
  };
}