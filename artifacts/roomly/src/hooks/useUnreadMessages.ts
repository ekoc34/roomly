import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user || !supabase) return;

    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`);

    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    if (convIds.length === 0) {
      setUnreadCount(0);
      return;
    }

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);

    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) return;

    fetchUnread();

    const channel = supabase
      .channel(`unread-messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (payload.new.sender_id !== user.id) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [user, fetchUnread]);

  return { unreadCount };
}
