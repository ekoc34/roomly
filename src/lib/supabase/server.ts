import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error("Ontbrekende Supabase-omgevingsvariabelen.");
  }
  const { url, anonKey: key } = cfg;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server Component — cookies kunnen hier niet gezet worden */
        }
      },
    },
  });
}
