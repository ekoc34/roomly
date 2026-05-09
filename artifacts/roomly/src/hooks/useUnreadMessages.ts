import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!user || !supabase) return;

    try {
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
    } catch {
      setUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) {
      setUnreadCount(null);
      return;
    }

    fetchUnread();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `unread-messages:${user.id}:${Date.now()}`;

    try {
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            if (payload.new.sender_id !== user.id) {
              setUnreadCount((prev) => (prev === null ? 1 : prev + 1));
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
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("Realtime unread channel error — falling back to polling.");
          }
        });

      channelRef.current = channel;
    } catch (e) {
      console.warn("Supabase realtime bağlantı hatası, uygulama çalışmaya devam ediyor.", e);
    }

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchUnread]);

  return { unreadCount };
}
