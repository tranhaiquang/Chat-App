import type { Session, User } from '@supabase/supabase-js';

import { supabase } from './supabase';

export interface AuthResult {
  user: User;
  session: Session;
}

/** Signs up with email + password and stores the profile display fields. */
export async function signUp(
  email: string,
  password: string,
  username: string,
  displayName?: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: username.trim(),
        display_name: displayName?.trim() || username.trim(),
      },
    },
  });

  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error('Sign-up succeeded but no session was returned. Try signing in.');
  }

  return { user: data.user, session: data.session };
}

/** Signs in with email + password. */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error('Sign-in failed. Check your email and password.');
  }

  return { user: data.user, session: data.session };
}

/** Signs the current user out. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Reads the currently stored session, if any. */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
