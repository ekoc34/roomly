import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, Listing, Profile } from "@/types/database";

type LastMsg = { body: string; created_at: string; sender_id: string; read_at: string | null };
type ConvRow = Conversation & { listing: Listing | null; other: Profile | null; lastMsg: LastMsg | null; hasUnread: boolean };

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "zojuist";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} uur geleden`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay <= 7) return `${diffDay} dag${diffDay === 1 ? "" : "en"} geleden`;
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }

    async function fetchConvs() {
      try {
        const { data, error: queryError } = await supabase!
          .from("conversations")
          .select(
            "*, listing:listings!left(*), tenant:tenant_id!left(*), landlord:landlord_id!left(*), messages!left(body, created_at, sender_id, read_at)"
          )
          .or(`tenant_id.eq.${user!.id},landlord_id.eq.${user!.id}`)
          .or(`hidden_by.is.null,hidden_by.not.cs.{${user!.id}}`)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (queryError) {
          console.error("[MessagesPage] Supabase query error:", queryError);
          setError("Er is iets misgegaan bij het ophalen van je berichten.");
          setConvs([]);
          setLoading(false);
          return;
        }

        const rows = (
          (data ?? []) as (Conversation & {
            listing: Listing | null;
            tenant: Profile | null;
            landlord: Profile | null;
            messages: LastMsg[] | null;
          })[]
        ).map((row) => {
          const msgs = row.messages ?? [];
          const lastMsg = msgs.length > 0
            ? msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b))
            : null;
          const hasUnread = msgs.some((m) => m.sender_id !== user!.id && m.read_at === null);
          return {
            ...row,
            other: row.tenant_id === user!.id ? row.landlord : row.tenant,
            lastMsg,
            hasUnread,
          };
        });

        setConvs(rows);
      } catch (err) {
        console.error("[MessagesPage] Unexpected error fetching conversations:", err);
        setError("Er is iets misgegaan. Probeer de pagina opnieuw te laden.");
        setConvs([]);
      } finally {
        setLoading(false);
      }
    }

    fetchConvs();
  }, [user, authLoading]);

  // Real-time: pick up new conversations the moment they are created
  // (e.g. landlord accepts an application while tenant is already on this page).
  // Supabase postgres_changes only supports a single-column filter, so we use
  // two channels — one per role.
  useEffect(() => {
    if (!user || !supabase) return;

    const fetchAndPrepend = async (convId: string) => {
      const { data } = await supabase!
        .from("conversations")
        .select("*, listing:listings!left(*), tenant:tenant_id!left(*), landlord:landlord_id!left(*), messages!left(body, created_at, sender_id, read_at)")
        .eq("id", convId)
        .not("hidden_by", "cs", `{${user!.id}}`)
        .maybeSingle();

      if (!data) return;

      const raw = data as Conversation & { listing: Listing | null; tenant: Profile | null; landlord: Profile | null; messages: LastMsg[] | null };
      const msgs = raw.messages ?? [];
      const lastMsg = msgs.length > 0 ? msgs.reduce((a, b) => (a.created_at > b.created_at ? a : b)) : null;
      const hasUnread = msgs.some((m) => m.sender_id !== user!.id && m.read_at === null);

      const row: ConvRow = {
        ...raw,
        other: raw.tenant_id === user!.id ? raw.landlord : raw.tenant,
        lastMsg,
        hasUnread,
      };

      setConvs((prev) => {
        if (prev.some((c) => c.id === convId)) return prev;
        return [row, ...prev];
      });
    };

    const tenantCh = supabase
      .channel(`messages-rt-tenant:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `tenant_id=eq.${user.id}` },
        (payload) => fetchAndPrepend((payload.new as { id: string }).id)
      )
      .subscribe();

    const landlordCh = supabase
      .channel(`messages-rt-landlord:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `landlord_id=eq.${user.id}` },
        (payload) => fetchAndPrepend((payload.new as { id: string }).id)
      )
      .subscribe();

    // Real-time preview: when a new message is inserted in any conversation the
    // user belongs to, update that row's preview text, timestamp, and unread dot
    // instantly and float it to the top of the list — no extra fetch required.
    const msgPreviewCh = supabase
      .channel(`messages-preview-rt:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const { conversation_id, body, created_at, sender_id, read_at } = payload.new as {
            conversation_id: string;
            body: string;
            created_at: string;
            sender_id: string;
            read_at: string | null;
          };
          setConvs((prev) => {
            const idx = prev.findIndex((c) => c.id === conversation_id);
            if (idx === -1) return prev;
            const updated: ConvRow = {
              ...prev[idx],
              last_message_at: created_at,
              lastMsg: { body, created_at, sender_id, read_at },
              hasUnread: prev[idx].hasUnread || (sender_id !== user.id && read_at === null),
            };
            const rest = prev.filter((_, i) => i !== idx);
            return [updated, ...rest];
          });
        }
      )
      // When the other participant opens the conversation, ConversationPage bulk-updates
      // read_at on all messages. The first UPDATE event clears the unread dot.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const { conversation_id, read_at } = payload.new as {
            conversation_id: string;
            read_at: string | null;
          };
          if (!read_at) return;
          setConvs((prev) =>
            prev.map((c) =>
              c.id === conversation_id ? { ...c, hasUnread: false } : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tenantCh);
      supabase.removeChannel(landlordCh);
      supabase.removeChannel(msgPreviewCh);
    };
  }, [user]);

  async function handleUndo(conv: ConvRow) {
    if (!supabase || !user) return;

    // Restore optimistically — prepend so it appears at the top
    setConvs((prev) => [conv, ...prev]);

    // Write the original hidden_by (without current user's ID) back to Supabase
    const { error: undoError } = await supabase
      .from("conversations")
      .update({ hidden_by: conv.hidden_by })
      .eq("id", conv.id);

    if (undoError) {
      console.error("[MessagesPage] Failed to restore conversation:", undoError);
      setConvs((prev) => prev.filter((c) => c.id !== conv.id));
      toast.error("Herstellen mislukt. Probeer het opnieuw.");
      return;
    }

    toast.success("Gesprek hersteld");
  }

  async function handleDelete(convId: string) {
    if (!supabase || !user || deleting) return;
    setDeleting(true);

    // Capture the conversation before removal so we can undo
    const conv = convs.find((c) => c.id === convId);
    const originalHidden: string[] = conv?.hidden_by ?? [];

    // Optimistic removal + close inline confirm
    setConvs((prev) => prev.filter((c) => c.id !== convId));
    setConfirmId(null);

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ hidden_by: [...originalHidden, user.id] })
      .eq("id", convId);

    if (updateError) {
      console.error("[MessagesPage] Failed to hide conversation:", updateError);
      if (conv) setConvs((prev) => [conv, ...prev]);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
      setDeleting(false);
      return;
    }

    // Show undo toast — conv captured above still has the original hidden_by
    if (conv) {
      toast("Gesprek verwijderd", {
        duration: 6000,
        action: {
          label: "Ongedaan maken",
          onClick: () => handleUndo(conv),
        },
      });
    }

    setDeleting(false);
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je berichten te zien</h1>
        <Link href="/inloggen?next=/berichten" data-testid="messages-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-stone-900">Berichten</h1>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
              <div className="h-12 w-12 animate-pulse rounded-full bg-stone-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse rounded-full bg-stone-200" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      ) : convs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-20 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
            <svg className="h-7 w-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-stone-800">Geen berichten</h3>
          <p className="mt-2 text-sm text-stone-500">Reageer op een advertentie om een gesprek te starten.</p>
          <Link href="/kamers" className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Bekijk woningen</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {convs.map((conv) => {
            const initial = (conv.other?.name ?? conv.other?.email ?? "?").slice(0, 1).toUpperCase();
            const title = conv.listing?.title ?? "Verwijderde advertentie";
            const ts = conv.last_message_at ? timeAgo(conv.last_message_at) : "";
            const preview = conv.lastMsg
              ? conv.lastMsg.body.slice(0, 60) + (conv.lastMsg.body.length > 60 ? "…" : "")
              : null;
            return (
              <div key={conv.id} className="group relative flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Link
                  href={`/berichten/${conv.id}`}
                  data-testid={`conversation-${conv.id}`}
                  className="flex flex-1 min-w-0 items-center gap-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                    {conv.other?.avatar_url ? (
                      <img src={conv.other.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-base font-semibold text-stone-500">{initial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-stone-900">{conv.other?.name ?? "Gebruiker"}</p>
                      {conv.hasUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                    </div>
                    <p className="truncate text-xs text-stone-500">{title}</p>
                    {preview && (
                      <p className="truncate text-xs text-stone-400">{preview}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-stone-400 pr-2">{ts}</span>
                </Link>

                {confirmId === conv.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-stone-500 hidden sm:inline">Verwijderen?</span>
                    <button
                      onClick={() => handleDelete(conv.id)}
                      disabled={deleting}
                      className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
                    >
                      Ja
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                    >
                      Nee
                    </button>
                  </div>
                ) : (
                  <button
                    aria-label="Gesprek verwijderen"
                    onClick={() => setConfirmId(conv.id)}
                    className="shrink-0 rounded-lg p-1.5 text-stone-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
