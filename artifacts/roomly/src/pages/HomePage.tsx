import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { HeroSearch } from "@/components/home/HeroSearch";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { NeighborhoodSection } from "@/components/home/NeighborhoodSection";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import type { Listing, UserType } from "@/types/database";

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
  const [responseTimeBadges, setResponseTimeBadges] = useState<Record<string, number | null>>({});
  const [roommateListings, setRoommateListings] = useState<Listing[]>([]);
  const [roommateProfiles, setRoommateProfiles] = useState<Record<string, RoommateProfile>>({});
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, { name: string | null; avatar_url: string | null }>>({});
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      try {
        // Order by boosted_at DESC NULLS LAST so actively-boosted listings
        // (boosted_at within the last hour) float to the top naturally.
        // Fall back to created_at-only if the column doesn't exist yet.
        let woningenResult = await supabase
          .from("listings")
          .select("*")
          .in("type", ["room_for_rent", "short_stay"])
          .order("boosted_at", { ascending: false, nullsFirst: false })
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
            .select("id, email_auto_verified, phone_verified, name, avatar_url, lifestyle_tags, avg_response_time_hours, show_avatar_in_listings")
            .in("id", allOwnerIds);

          const badgeMap: Record<string, string | null> = {};
          const rtMap: Record<string, number | null> = {};
          const rmProfileMap: Record<string, RoommateProfile> = {};
          const ownerProfileMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

          for (const p of (profiles ?? []) as {
            id: string;
            email_auto_verified: boolean;
            phone_verified: boolean;
            name: string | null;
            avatar_url: string | null;
            lifestyle_tags: string[] | null;
            avg_response_time_hours: number | null;
            show_avatar_in_listings: boolean | null;
          }[]) {
            const avatarVisible = p.show_avatar_in_listings !== false;
            badgeMap[p.id] = p.email_auto_verified && p.phone_verified ? "Geverifieerd" : null;
            rtMap[p.id] = p.avg_response_time_hours ?? null;
            rmProfileMap[p.id] = {
              name: p.name,
              avatar_url: avatarVisible ? p.avatar_url : null,
              lifestyle_tags: p.lifestyle_tags,
            };
            ownerProfileMap[p.id] = {
              name: p.name,
              avatar_url: avatarVisible ? p.avatar_url : null,
            };
          }

          setVerificationBadges(badgeMap);
          setResponseTimeBadges(rtMap);
          setRoommateProfiles(rmProfileMap);
          setOwnerProfiles(ownerProfileMap);
        }

        if (user) {
          const { data: ownProfile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();
          if (ownProfile) setUserType((ownProfile as { user_type: UserType }).user_type);
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
          responseTimeBadges={responseTimeBadges}
          roommateListings={roommateListings}
          roommateProfiles={roommateProfiles}
          ownerProfiles={ownerProfiles}
          currentUserId={user?.id ?? null}
          userType={userType}
        />
      )}

      {/* Hoe het werkt — compact, for scrollers */}
      <section className="mt-16 border-t border-stone-200 pt-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-500">Hoe het werkt</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {/* Stap 1 */}
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Zoek je woning</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">Zoek op stad, budget of woningtype door heel Nederland.</p>
              </div>
            </div>
            {/* Stap 2 */}
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Verifieer je profiel</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">Praat met echte mensen via geverifieerde accounts. Verifieer je profiel voor meer vertrouwen tussen huurders en verhuurders.</p>
              </div>
            </div>
            {/* Stap 3 */}
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-stone-900">Reageer direct</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">Chat veilig via Welkthuis.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
