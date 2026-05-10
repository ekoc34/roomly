import { Link } from "wouter";
import { Users } from "lucide-react";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { CompareButton } from "@/components/listings/CompareButton";
import { LISTING_TYPE_LABELS, NEW_LABEL_RECENT_HOURS, NEW_LABEL_TODAY_HOURS } from "@/lib/constants";

import type { Listing } from "@/types/database";

type Props = {
  listing: Listing;
  isFavorited?: boolean;
  verificationBadge?: string | null;
};

function getNewLabel(createdAt: string): "vandaag" | "nieuw" | null {
  const diffHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (diffHours < NEW_LABEL_TODAY_HOURS) return "vandaag";
  if (diffHours < NEW_LABEL_RECENT_HOURS) return "nieuw";
  return null;
}

export function ListingCard({ listing, isFavorited = false, verificationBadge }: Props) {
  const isLandlordVerified = !!verificationBadge;
  const img = listing.images[0];
  const typeLabel = LISTING_TYPE_LABELS[listing.type];
  const newLabel = getNewLabel(listing.created_at);

  return (
    <div className="group relative">
      <FavoriteButton listingId={listing.id} initialFavorited={isFavorited} ownerUserId={listing.user_id} />
      <Link
        href={`/kamers/${listing.id}`}
        data-testid={`listing-card-${listing.id}`}
        className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative aspect-[4/3] bg-stone-100">
          {img ? (
            <img src={img} alt={listing.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-100 to-stone-200">
              <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs text-stone-400">Geen foto</span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {newLabel === "vandaag" && (
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Nieuw vandaag</span>
            )}
            {newLabel === "nieuw" && (
              <span className="rounded-full bg-stone-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Nieuw</span>
            )}
            {isLandlordVerified && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-stone-900">€{Number(listing.price).toFixed(0)}</span>
            <span className="text-sm font-normal text-stone-400">/ maand</span>
          </div>

          <p className="mt-1.5 line-clamp-1 font-semibold leading-snug text-stone-800 group-hover:text-rose-600">{listing.title}</p>

          <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{listing.location}</span>
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {listing.type === "roommate_search" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                <Users className="h-3 w-3 shrink-0" />
                Huisgenoot gezocht
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                {typeLabel}
              </span>
            )}
            {listing.rooms != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {listing.rooms} kamer{listing.rooms !== 1 ? "s" : ""}
              </span>
            )}
            {listing.surface_area != null && (
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                {listing.surface_area} m²
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center">
            <CompareButton listingId={listing.id} />
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
            {listing.availability_date ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Beschikbaar per {new Date(listing.availability_date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Beschikbaar
              </span>
            )}
            {verificationBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {verificationBadge}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
