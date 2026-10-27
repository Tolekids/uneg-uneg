import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : '';
const key = rawKey ?? '';

export const isConfigured = Boolean(url && key);
export const FUNCTIONS_URL = isConfigured ? `${url.replace(/\/$/, '')}/functions/v1` : '';
export const PUBLISHABLE_KEY = key ?? '';

export function createSupabase({ persistSession = false } = {}) {
  if (!isConfigured) return null;
  return createClient(url, key, { auth: { persistSession, autoRefreshToken: persistSession } });
}

// Klien publik untuk membaca feed (dibatasi RLS: hanya postingan published).
export const supabase = createSupabase();
