import { Suspense } from "react";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { fetchListings } from "@/lib/data/listings";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type Search = {
  q?: string;
  min?: string;
  max?: string;
  district?: string;
  type?: string;
};

function FiltersSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-2xl bg-stone-200/60" aria-hidden />
  );
}

export default async function KamersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const listings = isSupabaseConfigured()
    ? await fetchListings({
        q: sp.q,
        min: sp.min,
        max: sp.max,
        district: sp.district,
        type: sp.type,
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
          Kamers en mede-huurders
        </h1>
        <p className="mt-2 text-sm text-stone-500 sm:text-base">
          Filter op prijs, stadsdeel en type. Alles in Amsterdam — later breiden we
          uit naar heel Nederland.
        </p>
      </div>

      <div className="mt-8">
        <Suspense fallback={<FiltersSkeleton />}>
          <ListingFilters />
        </Suspense>
      </div>

      {!isSupabaseConfigured() ? (
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is niet geconfigureerd. Zie .env.local.example.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center text-sm text-stone-500">
            Geen resultaten. Pas je filters aan of plaats zelf een advertentie.
          </p>
        ) : (
          listings.map((l) => <ListingCard key={l.id} listing={l} />)
        )}
      </div>
    </div>
  );
}
