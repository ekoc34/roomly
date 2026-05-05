import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ListingCard } from "@/components/listings/ListingCard";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Listing } from "@/types/database";

export function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/inloggen?next=/favorieten"); return; }
    async function load() {
      if (!supabase || !user) return;
      const { data } = await supabase.from("favorites").select("listing_id, listings(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      const ls = (data ?? []).map((row: { listings: unknown }) => row.listings).filter(Boolean) as Listing[];
      setListings(ls);
      setLoading(false);
    }
    load();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-28 md:pb-8">
      <div className="mb-6 h-7 w-40 animate-pulse rounded-full bg-stone-200" />
      <SkeletonGrid count={6} />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Favorieten</h1>
        <p className="mt-1 text-sm text-stone-500">Woningen die je hebt opgeslagen.</p>
      </div>
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          </div>
          <h2 className="mt-4 text-base font-semibold text-stone-800">Geen favorieten</h2>
          <p className="mt-2 max-w-xs text-sm text-stone-500">Sla woningen op door op het hartje te klikken.</p>
          <Link href="/kamers" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Zoek woningen</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => <ListingCard key={l.id} listing={l} isFavorited />)}
        </div>
      )}
    </div>
  );
}
