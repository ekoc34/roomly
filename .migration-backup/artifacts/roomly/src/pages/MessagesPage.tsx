import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type ConvRow = {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  last_message_at: string;
  listing_title: string;
  other_name: string | null;
  other_avatar: string | null;
  unread_count: number;
};

export function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen?next=/berichten"); return; }
    async function load() {
      if (!supabase || !user) return;
      const { data: convRows } = await supabase.from("conversations")
        .select("id, listing_id, tenant_id, landlord_id, last_message_at, listings(title), tenant:profiles!conversations_tenant_id_fkey(name, avatar_url), landlord:profiles!conversations_landlord_id_fkey(name, avatar_url)")
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      const rows: ConvRow[] = [];
      for (const row of (convRows ?? [])) {
        const isLandlord = row.landlord_id === user.id;
        const other = isLandlord ? (row as unknown as Record<string, unknown>).tenant as { name: string | null; avatar_url: string | null } | null : (row as unknown as Record<string, unknown>).landlord as { name: string | null; avatar_url: string | null } | null;
        const listing = (row as unknown as Record<string, unknown>).listings as { title: string } | null;

        const { count } = await supabase!.from("messages").select("id", { count: "exact", head: true })
          .eq("conversation_id", row.id).neq("sender_id", user.id).is("read_at", null);

        rows.push({
          id: row.id,
          listing_id: row.listing_id,
          tenant_id: row.tenant_id,
          landlord_id: row.landlord_id,
          last_message_at: row.last_message_at,
          listing_title: listing?.title ?? "Onbekende advertentie",
          other_name: other?.name ?? null,
          other_avatar: other?.avatar_url ?? null,
          unread_count: count ?? 0,
        });
      }
      setConvs(rows);
      setLoading(false);
    }
    load();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 pb-28 md:pb-8">
      <div className="mb-6 h-7 w-40 animate-pulse rounded-full bg-stone-200" />
      <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-stone-200" />)}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Berichten</h1>
        <p className="mt-1 text-sm text-stone-500">Jouw gesprekken over woningen.</p>
      </div>
      {convs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <h2 className="mt-4 text-base font-semibold text-stone-800">Nog geen berichten</h2>
          <p className="mt-2 max-w-xs text-sm text-stone-500">Start een gesprek door op een advertentie te reageren.</p>
          <Link href="/kamers" className="mt-5 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Zoek woningen</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {convs.map((c) => {
            const initial = (c.other_name ?? "?").slice(0, 1).toUpperCase();
            const timeAgo = new Date(c.last_message_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
            return (
              <Link key={c.id} href={`/berichten/${c.id}`} data-testid={`conversation-${c.id}`} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                  {c.other_avatar ? <img src={c.other_avatar} alt="" className="h-full w-full object-cover" /> : <span className="text-base font-semibold text-stone-500">{initial}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{c.other_name ?? "Roomly gebruiker"}</p>
                  <p className="truncate text-xs text-stone-500">{c.listing_title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-xs text-stone-400">{timeAgo}</p>
                  {c.unread_count > 0 && (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{c.unread_count > 9 ? "9+" : c.unread_count}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
