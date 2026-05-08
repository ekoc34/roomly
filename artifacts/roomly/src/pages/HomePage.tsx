import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { HeroSearch } from "@/components/home/HeroSearch";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { NeighborhoodSection } from "@/components/home/NeighborhoodSection";
import { WhyRoomly } from "@/components/home/WhyRoomly";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import type { Listing } from "@/types/database";

function HomePageContent() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      try {
        let query = supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(8);
        if (user) query = query.neq("user_id", user.id);
        const [{ data: ls }, { data: favs }] = await Promise.all([
          query,
          user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : { data: [] },
        ]);
        setListings((ls as Listing[] | null) ?? []);
        setFavoriteIds(((favs ?? []) as { listing_id: string }[]).map((f) => f.listing_id));
      } catch {
        // silently fail — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <HeroSearch />
      {!loading && listings.length === 0 && !user && <OnboardingBanner />}

      {/* Neighborhood section — appears when a city is selected */}
      <NeighborhoodSection />

      {loading ? (
        <div className="mt-16">
          <SkeletonGrid count={6} />
        </div>
      ) : (
        <FeaturedListings listings={listings} favoriteIds={favoriteIds} />
      )}

      <WhyRoomly />
    </div>
  );
}

export function HomePage() {
  return <HomePageContent />;
}
