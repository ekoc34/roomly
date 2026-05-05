import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Listing } from "@/types/database";

export function ListingsPage() {
  const { user } = useAuth();
  const searchString = useSearch();
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      setLoading(true);
      const params = new URLSearchParams(searchString);
      const q = params.get("q") ?? "";
      const district = params.get("district") ?? "";
      const type = params.get("type") ?? "";
      const min = params.get("min") ? Number(params.get("min")) : null;
      const max = params.get("max") ? Number(params.get("max")) : null;
      const sort = params.get("sort") ?? "newest";

      let query = supabase.from("listings").select("*", { count: "exact" });

      if (q) query = query.ilike("title", `%${q}%`);
      if (district) query = query.ilike("location", `%${district}%`);
      if (type) query = query.eq("type", type);
      if (min !== null) query = query.gte("price", min);
      if (max !== null) query = query.lte("price", max);

      if (sort === "cheapest") {
        query = query.order("price", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      query = query.limit(50);

      const [{ data: ls, count }, { data: favs }] = await Promise.all([
        query,
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [], count: null }),
      ]);

      setListings((ls ?? []) as Listing[]);
      setFavoriteIds((favs ?? []).map((f: { listing_id: string }) => f.listing_id));
      setTotal(count ?? null);
      setLoading(false);
    }
    load();
  }, [searchString, user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Woningen zoeken</h1>
        {!loading && total !== null && (
          <p className="mt-1 text-sm text-stone-500">{total} {total === 1 ? "woning" : "woningen"} gevonden</p>
        )}
      </div>
      <ListingFilters />
      <div className="mt-8">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-7 w-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-stone-800">Geen woningen gevonden</h2>
            <p className="mt-2 max-w-xs text-sm text-stone-500">Probeer andere filters of zoektermen.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} isFavorited={favoriteIds.includes(l.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
