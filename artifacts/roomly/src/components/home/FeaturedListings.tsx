import { Link } from "wouter";
import { ListingCard } from "@/components/listings/ListingCard";
import type { Listing } from "@/types/database";

type Props = {
  listings: Listing[];
  favoriteIds: string[];
};

export function FeaturedListings({ listings, favoriteIds }: Props) {
  return (
    <section className="mt-16" data-testid="featured-listings">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 sm:text-2xl">Populaire woningen</h2>
          <p className="mt-1 text-sm text-stone-500">De nieuwste woningen op Welkthuis.</p>
        </div>
        <Link href="/kamers" className="text-sm font-medium text-rose-600 hover:underline">Alles bekijken →</Link>
      </div>
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-stone-800">Nog geen uitgelichte woningen</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">Er zijn momenteel nog geen advertenties. Plaats als eerste een advertentie en help het platform groeien.</p>
          <Link href="/kamers/nieuw" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Plaats als eerste een advertentie
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} isFavorited={favoriteIds.includes(l.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
