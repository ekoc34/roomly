import Link from "next/link";
import { ListingCard } from "@/components/listings/ListingCard";
import type { Listing } from "@/types/database";

type Props = {
  listings: Listing[];
};

export function FeaturedListings({ listings }: Props) {
  return (
    <section className="mt-16">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 sm:text-2xl">
            Uitgelichte advertenties
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Populaire kamers en mede-huurders in Amsterdam.
          </p>
        </div>
        <Link
          href="/kamers"
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Alles bekijken
        </Link>
      </div>
      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center text-sm text-stone-500">
          Nog geen advertenties. Wees de eerste die een kamer plaatst.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </section>
  );
}
