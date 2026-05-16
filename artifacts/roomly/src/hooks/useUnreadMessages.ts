import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const initialFetchDoneRef = useRef(false);

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
        initialFetchDoneRef.current = true;
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
    } finally {
      initialFetchDoneRef.current = true;
    }
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) {
      setUnreadCount(null);
      return;
    }

    // Reset the fetch guard when user changes
    initialFetchDoneRef.current = false;
    fetchUnread();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Stable channel name (no timestamp) — prevents channel accumulation on re-renders.
    // Subscribes to INSERT and UPDATE on messages then re-fetches the accurate count
    // rather than applying an optimistic increment from unfiltered realtime events
    // (the realtime channel has no server-side filter, so all message events would
    // flow to every client; re-fetching is safer and still fast).
    const channelName = `unread-messages:${user.id}`;

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
          () => {
            if (initialFetchDoneRef.current) {
              fetchUnread();
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
            if (initialFetchDoneRef.current) {
              fetchUnread();
            }
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("Realtime unread channel error — falling back to polling.");
          }
        });

      channelRef.current = channel;
    } catch (e) {
      console.warn("Supabase realtime verbindingsfout, applicatie blijft werken.", e);
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
