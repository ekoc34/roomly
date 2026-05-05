import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("Ontbrekende Supabase-omgevingsvariabelen.");
  }
  return createBrowserClient(cfg.url, cfg.anonKey);
}
