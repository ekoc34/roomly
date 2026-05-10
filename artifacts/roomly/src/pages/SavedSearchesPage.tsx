import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { SavedSearch } from "@/types/database";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

function filterSummary(filters: Record<string, string>): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.district) parts.push(filters.district);
  if (filters.type) parts.push(LISTING_TYPE_LABELS[filters.type as ListingType] ?? filters.type);
  if (filters.min && filters.max && Number(filters.max) < 10000)
    parts.push(`€${filters.min}–€${filters.max}`);
  else if (filters.min && Number(filters.min) > 0) parts.push(`min €${filters.min}`);
  else if (filters.max && Number(filters.max) < 10000) parts.push(`max €${filters.max}`);
  if (filters.rooms) parts.push(`${filters.rooms}+ kamers`);
  if (filters.min_surface) parts.push(`min ${filters.min_surface} m²`);
  if (filters.pets === "1") parts.push("huisdieren OK");
  if (filters.smoking === "1") parts.push("roken OK");
  if (filters.gender) {
    parts.push({ man: "alleen mannen", vrouw: "alleen vrouwen", gemengd: "gemengd" }[filters.gender] ?? filters.gender);
  }
  return parts.join(" · ") || "Alle woningen";
}

function filtersToSearch(filters: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  return p.toString();
}

export function SavedSearchesPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }
    supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSearches((data as SavedSearch[] | null) ?? []);
        setLoading(false);
      });
  }, [user, authLoading]);

  const handleToggleNotify = async (id: string, current: boolean) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("saved_searches")
      .update({ notify: !current })
      .eq("id", id);
    if (error) { toast.error("Bijwerken mislukt."); return; }
    setSearches((prev) => prev.map((s) => s.id === id ? { ...s, notify: !current } : s));
    toast.success(!current ? "Notificaties ingeschakeld." : "Notificaties uitgeschakeld.");
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) { toast.error("Verwijderen mislukt."); return; }
    setSearches((prev) => prev.filter((s) => s.id !== id));
    toast.success("Zoekopdracht verwijderd.");
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om opgeslagen zoekopdrachten te bekijken</h1>
        <Link href="/inloggen?next=/opgeslagen-zoekopdrachten" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="transition hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Opgeslagen zoekopdrachten</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Opgeslagen zoekopdrachten</h1>
          <p className="mt-1 text-sm text-stone-500">Ontvang een melding zodra een nieuwe woning overeenkomt.</p>
        </div>
        <Link
          href="/kamers"
          className="shrink-0 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
        >
          + Nieuwe zoekopdracht
        </Link>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl bg-stone-200" />
            ))}
          </div>
        ) : searches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-6 w-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-stone-700">Geen opgeslagen zoekopdrachten</p>
            <p className="mt-1 text-xs text-stone-400">Zoek op woningen en sla je zoekopdracht op om meldingen te ontvangen.</p>
            <Link href="/kamers" className="mt-4 text-xs font-semibold text-rose-600 hover:underline">Zoek woningen →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {searches.map((s) => {
              const searchHref = `/kamers?${filtersToSearch(s.filters)}`;
              const summary = filterSummary(s.filters);
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => navigate(searchHref)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-semibold text-stone-900 truncate">{s.name}</p>
                    <p className="mt-0.5 text-xs text-stone-500 truncate">{summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                      <span>Opgeslagen op {new Date(s.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
                      {s.last_matched_at && (
                        <>
                          <span className="text-stone-200">·</span>
                          <span>Laatste match: {new Date(s.last_matched_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Notify toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleNotify(s.id, s.notify)}
                      title={s.notify ? "Notificaties uit" : "Notificaties aan"}
                      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        s.notify
                          ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100"
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" fill={s.notify ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {s.notify ? "Notificaties aan" : "Notificaties uit"}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      title="Verwijderen"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
