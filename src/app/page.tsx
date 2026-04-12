import { FeaturedListings } from "@/components/home/FeaturedListings";
import { HeroSearch } from "@/components/home/HeroSearch";
import { OnboardingBanner } from "@/components/home/OnboardingBanner";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchFeaturedListings } from "@/lib/data/listings";

export default async function HomePage() {
  const listings = isSupabaseConfigured()
    ? await fetchFeaturedListings(6)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <HeroSearch />

      <OnboardingBanner />

      <FeaturedListings listings={listings} />
    </div>
  );
}
