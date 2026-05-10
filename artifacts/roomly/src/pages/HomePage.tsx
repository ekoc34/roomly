import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
  const [verificationBadges, setVerificationBadges] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      try {
        const query = supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(8);
        const [{ data: ls }, { data: favs }] = await Promise.all([
          query,
          user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : { data: [] },
        ]);
        const fetchedListings = (ls as Listing[] | null) ?? [];
        setListings(fetchedListings);
        setFavoriteIds(((favs ?? []) as { listing_id: string }[]).map((f) => f.listing_id));

        const ownerIds = [...new Set(fetchedListings.map((l) => l.user_id))];
        if (ownerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email_auto_verified, phone_verified")
            .in("id", ownerIds);
          const badgeMap: Record<string, string | null> = {};
          for (const p of (profiles ?? []) as { id: string; email_auto_verified: boolean; phone_verified: boolean }[]) {
            badgeMap[p.id] = p.email_auto_verified && p.phone_verified ? "Geverifieerd" : null;
          }
          setVerificationBadges(badgeMap);
        }
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
        <FeaturedListings listings={listings} favoriteIds={favoriteIds} verificationBadges={verificationBadges} />
      )}

      <WhyRoomly />
    </div>
  );
}

export function HomePage() {
  return (
    <>
      <Helmet>
        <title>Welkthuis.nl — Vind je thuis in Nederland</title>
        <meta name="description" content="Vind kamers, appartementen en woningen in heel Nederland. Zoek op stad, prijs en type woning op Welkthuis.nl." />
      </Helmet>
      <HomePageContent />
    </>
  );
}
