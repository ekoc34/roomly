import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/types/database";

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    console.log("🛎️ [useNotifications] HOOK ÇALIŞTI, user:", user?.email);
    if (!user || !supabase) {
      console.warn("🛎️ [useNotifications] user veya supabase yok, çıkıyorum.");
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error("🛎️ [useNotifications] TABLO HATASI:", fetchError.message, "Kod:", fetchError.code);
      setError(fetchError.message);
      return;
    }

    const list = (data as Notification[]) ?? [];
    const unread = list.filter((n) => !n.read).length;
    console.log(`🛎️ [useNotifications] BAŞARILI: ${list.length} bildirim, ${unread} okunmamış`);
    setNotifications(list);
    setError(null);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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

  return { notifications, unreadCount, markRead, markAllRead, error };
}
