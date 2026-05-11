import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Notification } from "@/types/database";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "zojuist";
  if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`;
  if (diff < 86400 * 2) return "1 dag geleden";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} dagen geleden`;
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

function notifDot(type: Notification["type"]) {
  if (type === "new_application")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </span>
    );
  if (type === "application_accepted")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    );
  if (type === "application_rejected")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100">
        <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    );
  if (type === "new_matching_listing")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
        <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
      <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </span>
  );
}

function notifHref(n: Notification): string {
  if ((n.type === "application_accepted" || n.type === "new_message") && n.related_id)
    return `/berichten/${n.related_id}`;
  if (n.type === "new_matching_listing" && n.related_id)
    return `/kamers/${n.related_id}`;
  return "/dashboard";
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex items-start gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
          <div className="h-8 w-8 skeleton rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 skeleton rounded-full" />
            <div className="h-3 w-2/3 skeleton rounded-full" />
            <div className="h-3 w-1/4 skeleton rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen?next=/notificaties"); return; }
    fetchAll();

    if (!supabase) return;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    try {
      channel = supabase
        .channel(`notifications-page:${user.id}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("[NotificationsPage] Realtime channel error:", e);
    }

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [user, authLoading, fetchAll, navigate]);

  const handleClick = async (n: Notification) => {
    if (!n.read && supabase) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    navigate(notifHref(n));
  };

  const handleMarkAllRead = async () => {
    if (!supabase || !user) return;
    setMarkingAll(true);
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(false);
  };

  const handleMarkUnread = async (id: string) => {
    if (!supabase || !user) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: false } : n));
    const { error } = await supabase.from("notifications").update({ read: false }).eq("id", id);
    if (error) {
      setNotifications(previous);
      toast.error("Er ging iets mis. Probeer het opnieuw.");
    } else {
      toast.success("Gemeld als ongelezen.");
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!supabase || !user) return;
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setNotifications(previous);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    } else {
      toast.success("Melding verwijderd.");
    }
  };

  const handleDeleteAllRead = async () => {
    if (!supabase || !user) return;
    setDeletingAll(true);
    const previous = notifications;
    const readIds = notifications.filter((n) => n.read).map((n) => n.id);
    setNotifications((prev) => prev.filter((n) => !n.read));
    setConfirmDeleteAll(false);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)
      .eq("read", true);
    setDeletingAll(false);
    if (error) {
      setNotifications(previous);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    } else {
      toast.success(`${readIds.length} melding${readIds.length !== 1 ? "en" : ""} verwijderd.`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  return (
    <>
      <Helmet>
        <title>Notificaties — Welkthuis.nl</title>
        <meta name="description" content="Bekijk al je meldingen op één plek." />
      </Helmet>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Notificatiecentrum</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {unreadCount > 0 ? `${unreadCount} ongelezen melding${unreadCount !== 1 ? "en" : ""}` : "Alle meldingen gelezen"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="shrink-0 rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                {markingAll ? "Bezig…" : "Alles als gelezen markeren"}
              </button>
            )}
            {readCount > 0 && !confirmDeleteAll && (
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(true)}
                disabled={deletingAll}
                className="shrink-0 rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                Verwijder alle gelezen meldingen
              </button>
            )}
            {confirmDeleteAll && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2">
                <p className="text-sm font-medium text-rose-800">
                  Weet je zeker dat je alle gelezen meldingen wilt verwijderen?
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAllRead}
                  className="rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95"
                >
                  Ja, verwijderen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95"
                >
                  Annuleren
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <NotificationsSkeleton />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-stone-200/80 bg-white py-24 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="mt-4 text-base font-semibold text-stone-700">Geen notificaties</p>
            <p className="mt-1 text-sm text-stone-400">Je hebt nog geen meldingen ontvangen.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm divide-y divide-stone-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`group flex w-full items-center gap-2 pr-3 transition hover:bg-stone-50 ${
                  !n.read ? "bg-rose-50/50" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className="flex flex-1 items-start gap-4 px-5 py-4 text-left active:scale-[0.998]"
                >
                  {notifDot(n.type)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate text-sm text-stone-900 ${!n.read ? "font-bold" : "font-semibold"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{n.body}</p>
                    )}
                    <p className="mt-1 text-xs text-stone-400">{timeAgo(n.created_at)}</p>
                  </div>
                  <svg className="mt-1 h-4 w-4 shrink-0 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {n.read && (
                  <button
                    type="button"
                    aria-label="Markeer als ongelezen"
                    onClick={() => handleMarkUnread(n.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-300 opacity-0 transition hover:bg-amber-50 hover:text-amber-500 group-hover:opacity-100"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Melding verwijderen"
                  onClick={() => handleDeleteOne(n.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
