import Link from "next/link";
import { FeaturedListings } from "@/components/home/FeaturedListings";
import { HeroSearch } from "@/components/home/HeroSearch";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchFeaturedListings } from "@/lib/data/listings";

export default async function HomePage() {
  const listings = isSupabaseConfigured()
    ? await fetchFeaturedListings(6)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {!isSupabaseConfigured() ? (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Voeg <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          en{" "}
          <code className="rounded bg-amber-100 px-1">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          toe aan <code className="rounded bg-amber-100 px-1">.env.local</code> en voer
          het SQL-schema uit in Supabase.
        </div>
      ) : null}

      <HeroSearch />

      <div className="mt-12 flex justify-center">
        <Link
          href="/kamers"
          className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-8 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-stone-800"
        >
          Zoek een kamer
        </Link>
      </div>

      <FeaturedListings listings={listings} />
    </div>
  );
}
