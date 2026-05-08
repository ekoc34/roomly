import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/types/database";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !supabase) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications((data as Notification[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) return;
    fetchNotifications();

    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    try {
      channel = supabase
        .channel(`notifications:${user.id}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchNotifications()
        )
        .subscribe();
    } catch (e) {
      console.warn("Notification realtime channel error:", e);
    }

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    if (!supabase) return;
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!supabase || !user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { notifications, unreadCount, markRead, markAllRead };
}
