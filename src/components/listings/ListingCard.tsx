import Image from "next/image";
import Link from "next/link";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { Listing } from "@/types/database";

type Props = {
  listing: Listing;
};

export function ListingCard({ listing }: Props) {
  const img = listing.images[0];
  const typeLabel = LISTING_TYPE_LABELS[listing.type];

  return (
    <Link
      href={`/kamers/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {img ? (
          <Image
            src={img}
            alt=""
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">
            Geen foto
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-sm">
          {typeLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="line-clamp-2 font-semibold text-stone-900 group-hover:text-rose-600">
          {listing.title}
        </p>
        <p className="text-sm text-stone-500">{listing.location}</p>
        <p className="mt-auto pt-2 text-base font-semibold text-stone-900">
          €{Number(listing.price).toFixed(0)}{" "}
          <span className="text-sm font-normal text-stone-500">/ maand</span>
        </p>
      </div>
    </Link>
  );
}
