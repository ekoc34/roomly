import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, Listing, Profile } from "@/types/database";

type ConvRow = Conversation & { listing: Listing | null; other: Profile | null };

export function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }

    async function fetchConvs() {
      try {
        // 'listing:listings!left(*)' kullanarak çakışan foreign key hatasını çözüyoruz
        const { data, error: queryError } = await supabase!
          .from("conversations")
          .select(
            "*, listing:listings!left(*), tenant:tenant_id!left(*), landlord:landlord_id!left(*)"
          )
          .or(`tenant_id.eq.${user!.id},landlord_id.eq.${user!.id}`)
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
          })[]
        ).map((row) => ({
          ...row,
          other: row.tenant_id === user!.id ? row.landlord : row.tenant,
        }));

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

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je berichten te zien</h1>
        <Link href="/inloggen" data-testid="messages-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
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
            const ts = conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "";
            return (
              <Link key={conv.id} href={`/berichten/${conv.id}`} data-testid={`conversation-${conv.id}`} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                  {conv.other?.avatar_url ? (
                    <img src={conv.other.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-semibold text-stone-500">{initial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{conv.other?.name ?? "Gebruiker"}</p>
                  <p className="truncate text-xs text-stone-500">{title}</p>
                </div>
                <span className="shrink-0 text-xs text-stone-400">{ts}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
