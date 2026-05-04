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
    } catch (error) {
      // Server Component — cookies kunnen hier niet gezet worden.
      // Logged in dev only; middleware refreshes the session for protected routes.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[supabase/server] cookie set skipped:", error);
      }
    }
      },
    },
  });
}
