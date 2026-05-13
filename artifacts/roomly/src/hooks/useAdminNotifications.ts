import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type AdminNotifKind = "scam_report" | "user_report" | "contact_message";

export type AdminNotifItem = {
  id: string;
  kind: AdminNotifKind;
  title: string;
  preview: string;
  created_at: string;
};

type UseAdminNotificationsResult = {
  items: AdminNotifItem[];
  totalCount: number;
  loading: boolean;
};

export function useAdminNotifications(isAdmin: boolean): UseAdminNotificationsResult {
  const [items, setItems] = useState<AdminNotifItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelsRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]>[]>([]);
  const mountedRef = useRef(true);

  const fetchItems = useCallback(async () => {
    if (!supabase || !isAdmin) return;
    setLoading(true);

    try {
      const [scamRes, userRepRes, contactRes] = await Promise.all([
        supabase
          .from("listing_reports")
          .select("id, reason, created_at, listing_id, listings ( title )")
          .eq("category", "scam")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("user_reports")
          .select("id, reason, created_at, reporter:reporter_id ( name ), reported:reported_id ( name )")
          .eq("resolved", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("contact_messages")
          .select("id, name, subject, category, created_at")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const [countScam, countUserRep, countContact] = await Promise.all([
        supabase.from("listing_reports").select("*", { count: "exact", head: true }).eq("category", "scam"),
        supabase.from("user_reports").select("*", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("is_read", false),
      ]);

      if (!mountedRef.current) return;

      const merged: AdminNotifItem[] = [];

      for (const r of (scamRes.data ?? []) as {
        id: string; reason: string; created_at: string; listing_id: string;
        listings: { title: string } | null;
      }[]) {
        merged.push({
          id: r.id,
          kind: "scam_report",
          title: r.listings?.title ?? "Onbekende advertentie",
          preview: r.reason?.slice(0, 80) || "Scam-melding ontvangen",
          created_at: r.created_at,
        });
      }

      for (const r of (userRepRes.data ?? []) as {
        id: string; reason: string; created_at: string;
        reporter: { name: string | null } | null;
        reported: { name: string | null } | null;
      }[]) {
        merged.push({
          id: r.id,
          kind: "user_report",
          title: `${r.reporter?.name ?? "Gebruiker"} → ${r.reported?.name ?? "Gebruiker"}`,
          preview: r.reason === "blocked" ? "Geblokkeerd" : (r.reason ?? "Melding"),
          created_at: r.created_at,
        });
      }

      for (const r of (contactRes.data ?? []) as {
        id: string; name: string; subject: string; category: string; created_at: string;
      }[]) {
        merged.push({
          id: r.id,
          kind: "contact_message",
          title: r.subject || "Contactbericht",
          preview: `Van: ${r.name}`,
          created_at: r.created_at,
        });
      }

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(merged.slice(0, 5));
      setTotalCount(
        (countScam.count ?? 0) + (countUserRep.count ?? 0) + (countContact.count ?? 0)
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin || !supabase) {
      setItems([]);
      setTotalCount(0);
      return;
    }

    fetchItems();

    channelsRef.current.forEach((ch) => supabase!.removeChannel(ch));
    channelsRef.current = [];

    const ts = Date.now();

    const scamCh = supabase
      .channel(`admin-bell-scam:${ts}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listing_reports" }, (payload) => {
        if ((payload.new as { category?: string }).category === "scam") {
          setTotalCount((n) => n + 1);
          fetchItems();
        }
      })
      .subscribe();

    const userRepCh = supabase
      .channel(`admin-bell-userreports:${ts}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_reports" }, () => {
        setTotalCount((n) => n + 1);
        fetchItems();
      })
      .subscribe();

    const contactCh = supabase
      .channel(`admin-bell-contact:${ts}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_messages" }, () => {
        setTotalCount((n) => n + 1);
        fetchItems();
      })
      .subscribe();

    channelsRef.current = [scamCh, userRepCh, contactCh];

    return () => {
      channelsRef.current.forEach((ch) => supabase!.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [isAdmin, fetchItems]);

  return { items, totalCount, loading };
}
