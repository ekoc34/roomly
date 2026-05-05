import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { HeroSearch } from "@/components/home/HeroSearch";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { WhyRoomly } from "@/components/home/WhyRoomly";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import type { Listing } from "@/types/database";

export function HomePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      const [{ data: ls }, { data: favs }] = await Promise.all([
        supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(6),
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : { data: [] },
      ]);
      setListings((ls as Listing[] | null) ?? []);
      setFavoriteIds(((favs ?? []) as { listing_id: string }[]).map((f) => f.listing_id));
      setLoading(false);
    }
    fetchData();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <HeroSearch />
      {!loading && listings.length === 0 && !user && <OnboardingBanner />}
      {loading ? (
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
              <div className="aspect-[4/3] animate-pulse bg-stone-200" />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-200" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-200" />
                <div className="mt-auto h-5 w-1/3 animate-pulse rounded-full bg-stone-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <FeaturedListings listings={listings} favoriteIds={favoriteIds} />
      )}
      <WhyRoomly />
    </div>
  );
}
