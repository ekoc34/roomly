import { HeaderClient } from "./HeaderClient";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  let userEmail: string | null = null;
  if (getSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    } catch {
      userEmail = null;
    }
  }

  return <HeaderClient userEmail={userEmail} />;
}
