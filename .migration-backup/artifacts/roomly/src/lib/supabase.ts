import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return !!(url && anonKey);
}

export function getSupabaseClient() {
  if (!url || !anonKey) {
    throw new Error("Supabase is niet geconfigureerd.");
  }
  return createClient(url, anonKey);
}

export const supabase = isSupabaseConfigured()
  ? createClient(url!, anonKey!)
  : null;
