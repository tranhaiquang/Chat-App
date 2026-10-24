import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Thrown at import time when the env vars are missing, so a misconfigured
 * setup fails loudly instead of silently 401-ing on every request.
 */
function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in your Supabase project values.`,
    );
  }
  return value;
}

/**
 * Session persistence.
 *
 * On native we keep the session in AsyncStorage, which survives app restarts.
 * On web the browser's localStorage is already there and is what the Supabase
 * SDK expects, so we use it directly.
 */
const storage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => globalThis.localStorage.getItem(key),
        setItem: (key: string, value: string) =>
          globalThis.localStorage.setItem(key, value),
        removeItem: (key: string) => globalThis.localStorage.removeItem(key),
      }
    : AsyncStorage;

export const supabase = createClient(
  requireEnv(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL'),
  requireEnv(supabasePublishableKey, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
