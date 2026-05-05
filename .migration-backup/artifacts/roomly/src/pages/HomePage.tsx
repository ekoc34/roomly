import { useEffect, useState } from "react";
import { HeroSearch } from "@/components/home/HeroSearch";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import { WhyRoomly } from "@/components/home/WhyRoomly";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Listing } from "@/types/database";

export function HomePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const [{ data: ls }, { data: favs }] = await Promise.all([
        supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(6),
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);
      setListings((ls ?? []) as Listing[]);
      setFavoriteIds((favs ?? []).map((f: { listing_id: string }) => f.listing_id));
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 pb-28 md:pb-8">
      <HeroSearch />
      {!user && <OnboardingBanner />}
      {loading ? (
        <div className="mt-16">
          <div className="mb-6 h-7 w-48 animate-pulse rounded-full bg-stone-200" />
          <SkeletonGrid count={6} />
        </div>
      ) : (
        <FeaturedListings listings={listings} favoriteIds={favoriteIds} />
      )}
      <WhyRoomly />
    </div>
  );
}
