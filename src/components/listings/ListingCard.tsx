import Image from "next/image";
import Link from "next/link";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { Listing } from "@/types/database";

type Props = {
  listing: Listing;
};

function getNewLabel(createdAt: string): "vandaag" | "nieuw" | null {
  const diffHours =
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return "vandaag";
  if (diffHours < 72) return "nieuw";
  return null;
}

export function ListingCard({ listing }: Props) {
  const img = listing.images[0];
  const typeLabel = LISTING_TYPE_LABELS[listing.type];
  const newLabel = getNewLabel(listing.created_at);

  return (
    <Link
      href={`/kamers/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {img ? (
          <Image
            src={img}
            alt={listing.title}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width:768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs text-stone-400">Geen foto</span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-sm">
            {typeLabel}
          </span>
          {newLabel === "vandaag" && (
            <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              Nieuw vandaag
            </span>
          )}
          {newLabel === "nieuw" && (
            <span className="rounded-full bg-stone-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              Nieuw
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="line-clamp-2 font-semibold leading-snug text-stone-900 group-hover:text-rose-600">
          {listing.title}
        </p>

        <p className="flex items-center gap-1 text-sm text-stone-500">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {listing.location}
        </p>

        {listing.availability_date ? (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Beschikbaar per{" "}
            {new Date(listing.availability_date).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "short",
            })}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Beschikbaar
          </p>
        )}

        <p className="mt-auto border-t border-stone-100 pt-3 text-base font-bold text-stone-900">
          €{Number(listing.price).toFixed(0)}
          <span className="text-sm font-normal text-stone-500"> / maand</span>
        </p>
      </div>
    </Link>
  );
}
