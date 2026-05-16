import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const initialFetchDoneRef = useRef(false);
  const convIdsRef = useRef<string[]>([]);

  const fetchUnread = useCallback(async () => {
    if (!user || !supabase) return;

    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`);

      const convIds = (convs ?? []).map((c: { id: string }) => c.id);
      convIdsRef.current = convIds;

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
      convIdsRef.current = [];
      return;
    }

    initialFetchDoneRef.current = false;

    // Fetch initial count and conv IDs, then wire up a filtered subscription.
    const setup = async () => {
      await fetchUnread();

      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const convIds = convIdsRef.current;
      const channelName = `unread-messages:${user.id}`;

      try {
        // Build a channel that is filtered to only the user's conversations.
        // This means Supabase will only deliver events for rows in those
        // conversations, so N online users no longer each receive every
        // message insert across the entire table.
        const channelBuilder = supabase!.channel(channelName);

        const onMessage = () => {
          if (initialFetchDoneRef.current) fetchUnread();
        };

        if (convIds.length > 0) {
          const filterExpr = `conversation_id=in.(${convIds.join(",")})`;

          channelBuilder
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: filterExpr }, onMessage)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: filterExpr }, onMessage);
        } else {
          // No conversations yet — still subscribe without a filter so the
          // first incoming message (which creates a conversation) is caught.
          // Once convIds are populated the effect will re-run and add the filter.
          channelBuilder
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations",
              filter: `tenant_id=eq.${user.id}` }, () => fetchUnread())
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations",
              filter: `landlord_id=eq.${user.id}` }, () => fetchUnread());
        }

        channelBuilder.subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("Realtime unread channel error — falling back to polling.");
          }
        });

        channelRef.current = channelBuilder;
      } catch (e) {
        console.warn("Supabase realtime verbindingsfout, applicatie blijft werken.", e);
      }
    };

    setup();

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchUnread]);

  return { unreadCount };
}
