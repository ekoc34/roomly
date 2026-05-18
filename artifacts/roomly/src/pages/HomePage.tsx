import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { HeroSearch } from "@/components/home/HeroSearch";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { NeighborhoodSection } from "@/components/home/NeighborhoodSection";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import { WhyRoomly } from "@/components/home/WhyRoomly";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import type { Listing, UserType } from "@/types/database";

type RoommateProfile = {
  name: string | null;
  avatar_url: string | null;
  lifestyle_tags: string[] | null;
};

function HomePageContent() {
  const { user } = useAuth();
  const { t } = useLanguage();
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
            badgeMap[p.id] = p.email_auto_verified && p.phone_verified ? t("dashboard.verifiedBadge") : null;
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <HeroSearch />

      {!loading && listings.length === 0 && !user && (
        <div className="mt-8">
          <OnboardingBanner />
        </div>
      )}

      <NeighborhoodSection />

      {loading ? (
        <div className="mt-20">
          <SkeletonGrid count={6} />
        </div>
      ) : (
        <div className="mt-20">
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
        </div>
      )}

      {/* Platform features strip */}
      <section className="mt-20 border-t border-stone-100 pt-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{t("home.featuresVerifiedTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t("home.featuresVerifiedDesc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{t("home.featuresDirectTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t("home.featuresDirectDesc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50">
              <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{t("home.featuresSearchTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t("home.featuresSearchDesc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">{t("home.featuresForAllTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{t("home.featuresForAllDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-14">
        <WhyRoomly />
      </div>

    </div>
  );
}

export function HomePage() {
  const { t } = useLanguage();
  return (
    <>
      <Helmet>
        <title>Welkthuis.nl — {t("home.heroTitle")}</title>
        <meta name="description" content={t("home.heroSubtitle")} />
      </Helmet>
      <HomePageContent />
    </>
  );
}
