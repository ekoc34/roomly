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

type RoommateProfile = {
  name: string | null;
  avatar_url: string | null;
  lifestyle_tags: string[] | null;
};

function HomePageContent() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [verificationBadges, setVerificationBadges] = useState<Record<string, string | null>>({});
  const [roommateListings, setRoommateListings] = useState<Listing[]>([]);
  const [roommateProfiles, setRoommateProfiles] = useState<Record<string, RoommateProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      try {
        // Try boosted ordering first; fall back if the column doesn't exist yet
        let woningenResult = await supabase
          .from("listings")
          .select("*")
          .in("type", ["room_for_rent", "short_stay"])
          .order("boosted", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);

        if (woningenResult.error) {
          woningenResult = await supabase
            .from("listings")
            .select("*")
            .in("type", ["room_for_rent", "short_stay"])
            .order("created_at", { ascending: false })
            .limit(8);
        }

        const [{ data: rmls }, { data: favs }] = await Promise.all([
          supabase
            .from("listings")
            .select("*")
            .eq("type", "roommate_search")
            .order("created_at", { ascending: false })
            .limit(8),
          user
            ? supabase.from("favorites").select("listing_id").eq("user_id", user.id)
            : { data: [] },
        ]);

        const ls = woningenResult.data;

        const fetchedListings = (ls as Listing[] | null) ?? [];
        const fetchedRoommates = (rmls as Listing[] | null) ?? [];

        setListings(fetchedListings);
        setRoommateListings(fetchedRoommates);
        setFavoriteIds(((favs ?? []) as { listing_id: string }[]).map((f) => f.listing_id));

        const ownerIds = [...new Set(fetchedListings.map((l) => l.user_id))];
        const roommateOwnerIds = [...new Set(fetchedRoommates.map((l) => l.user_id))];
        const allOwnerIds = [...new Set([...ownerIds, ...roommateOwnerIds])];

        if (allOwnerIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email_auto_verified, phone_verified, name, avatar_url, lifestyle_tags")
            .in("id", allOwnerIds);

          const badgeMap: Record<string, string | null> = {};
          const rmProfileMap: Record<string, RoommateProfile> = {};

          for (const p of (profiles ?? []) as {
            id: string;
            email_auto_verified: boolean;
            phone_verified: boolean;
            name: string | null;
            avatar_url: string | null;
            lifestyle_tags: string[] | null;
          }[]) {
            badgeMap[p.id] = p.email_auto_verified && p.phone_verified ? "Geverifieerd" : null;
            rmProfileMap[p.id] = {
              name: p.name,
              avatar_url: p.avatar_url,
              lifestyle_tags: p.lifestyle_tags,
            };
          }

          setVerificationBadges(badgeMap);
          setRoommateProfiles(rmProfileMap);
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

      <NeighborhoodSection />

      {loading ? (
        <div className="mt-16">
          <SkeletonGrid count={6} />
        </div>
      ) : (
        <FeaturedListings
          listings={listings}
          favoriteIds={favoriteIds}
          verificationBadges={verificationBadges}
          roommateListings={roommateListings}
          roommateProfiles={roommateProfiles}
        />
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
