import { HeaderClient } from "./HeaderClient";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  let userEmail: string | null = null;
  let unread = 0;

  if (getSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;

      if (user) {
        const { data: convs } = await supabase
          .from("conversations")
          .select("id")
          .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`);
        const convIds = (convs ?? []).map((c: { id: string }) => c.id);
        if (convIds.length > 0) {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("conversation_id", convIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          unread = count ?? 0;
        }
      }
    } catch {
      userEmail = null;
    }
  }

  return <HeaderClient userEmail={userEmail} unreadMessages={unread} />;
}
