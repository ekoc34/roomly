import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LISTING_TYPE_LABELS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import type { Listing, Application } from "@/types/database";

type ApplicationWithListing = Application & {
  listing_title: string;
  listing_price: number;
  listing_location: string;
};

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<ApplicationWithListing[]>([]);
  const [myApplications, setMyApplications] = useState<ApplicationWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen?next=/dashboard"); return; }
    async function load() {
      if (!supabase || !user) return;
      const [{ data: listings }, { data: apps }] = await Promise.all([
        supabase.from("listings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("applications").select("*, listings(title, price, location)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setMyListings((listings ?? []) as Listing[]);

      const listingIds = (listings ?? []).map((l: Listing) => l.id);
      let recvApps: ApplicationWithListing[] = [];
      if (listingIds.length > 0) {
        const { data: recvRaw } = await supabase.from("applications").select("*, listings(title, price, location)").in("listing_id", listingIds).order("created_at", { ascending: false });
        recvApps = (recvRaw ?? []).map((a: Record<string, unknown>) => ({
          ...(a as unknown as Application),
          listing_title: (a.listings as { title: string; price: number; location: string })?.title ?? "?",
          listing_price: (a.listings as { title: string; price: number; location: string })?.price ?? 0,
          listing_location: (a.listings as { title: string; price: number; location: string })?.location ?? "?",
        }));
      }
      setReceivedApplications(recvApps);

      const myApps = (apps ?? []).map((a: Record<string, unknown>) => ({
        ...(a as unknown as Application),
        listing_title: (a.listings as { title: string; price: number; location: string })?.title ?? "?",
        listing_price: (a.listings as { title: string; price: number; location: string })?.price ?? 0,
        listing_location: (a.listings as { title: string; price: number; location: string })?.location ?? "?",
      }));
      setMyApplications(myApps);
      setLoading(false);
    }
    load();
  }, [user, authLoading, navigate]);

  const updateAppStatus = async (appId: string, status: "accepted" | "rejected") => {
    if (!supabase) return;
    await supabase.from("applications").update({ status }).eq("id", appId);
    setReceivedApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
  };

  const deleteListingAction = async (listingId: string) => {
    if (!confirm("Weet je zeker dat je deze advertentie wilt verwijderen?")) return;
    if (!supabase) return;
    await supabase.from("listings").delete().eq("id", listingId);
    setMyListings((prev) => prev.filter((l) => l.id !== listingId));
  };

  if (authLoading || loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" /></div>;

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-50 border-amber-200 text-amber-800",
    accepted: "bg-emerald-50 border-emerald-200 text-emerald-800",
    rejected: "bg-red-50 border-red-200 text-red-700",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 pb-28 md:pb-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">{user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/kamers/nieuw" className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600">+ Nieuwe advertentie</Link>
          <Link href="/profiel" className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-rose-200 hover:text-rose-700">Profiel</Link>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Mijn advertenties ({myListings.length})</h2>
        {myListings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-sm text-stone-500">Je hebt nog geen advertenties geplaatst.</p>
            <Link href="/kamers/nieuw" className="mt-4 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Eerste advertentie plaatsen</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myListings.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                  {l.images[0] ? <img src={l.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-stone-200" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{l.title}</p>
                  <p className="text-xs text-stone-500">{l.location} · {LISTING_TYPE_LABELS[l.type]} · €{Number(l.price).toFixed(0)}/maand</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/kamers/${l.id}`} className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-rose-200 hover:text-rose-700">Bekijken</Link>
                  <Link href={`/kamers/${l.id}/bewerken`} className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-rose-200 hover:text-rose-700">Bewerken</Link>
                  <button type="button" onClick={() => deleteListingAction(l.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">Verwijderen</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {receivedApplications.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Ontvangen aanvragen ({receivedApplications.length})</h2>
          <div className="space-y-3">
            {receivedApplications.map((a) => (
              <div key={a.id} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-stone-400">{a.listing_title}</p>
                    <p className="mt-1 text-sm text-stone-800">{a.message}</p>
                    {a.availability_text && <p className="mt-1 text-xs text-stone-500">Beschikbaar: {a.availability_text}</p>}
                    {a.budget && <p className="text-xs text-stone-500">Budget: €{a.budget}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[a.status] ?? ""}`}>{APPLICATION_STATUS_LABELS[a.status]}</span>
                </div>
                {a.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => updateAppStatus(a.id, "accepted")} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Accepteren</button>
                    <button type="button" onClick={() => updateAppStatus(a.id, "rejected")} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">Afwijzen</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {myApplications.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">Mijn aanvragen ({myApplications.length})</h2>
          <div className="space-y-3">
            {myApplications.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{a.listing_title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{a.listing_location} · €{Number(a.listing_price).toFixed(0)}/maand</p>
                  <p className="mt-1.5 line-clamp-2 text-xs text-stone-600">{a.message}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[a.status] ?? ""}`}>{APPLICATION_STATUS_LABELS[a.status]}</span>
                  <Link href={`/kamers/${a.listing_id}`} className="text-xs text-stone-400 hover:text-rose-600">Bekijken</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
