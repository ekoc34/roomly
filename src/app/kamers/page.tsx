import Link from "next/link";
import { Suspense } from "react";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
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
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is niet geconfigureerd. Zie{" "}
          <code className="rounded bg-amber-100 px-1">.env.local.example</code>.
        </div>
      ) : null}

      <div className="mt-10">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-7 w-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-stone-800">
              Geen kamers gevonden
            </h3>
            <p className="mt-2 max-w-sm text-sm text-stone-500">
              Er zijn geen kamers die overeenkomen met je filters. Pas je filters
              aan of plaats zelf een advertentie.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/kamers"
                className="inline-flex items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Filters wissen
              </Link>
              <Link
                href="/kamers/nieuw"
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Plaats advertentie
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
