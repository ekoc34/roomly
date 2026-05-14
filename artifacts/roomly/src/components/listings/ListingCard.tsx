import { Link } from "wouter";
import { Users } from "lucide-react";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { CompareButton } from "@/components/listings/CompareButton";
import { BoostBadge } from "@/components/listings/BoostBadge";
import { LISTING_TYPE_LABELS, NEW_LABEL_RECENT_HOURS, NEW_LABEL_TODAY_HOURS } from "@/lib/constants";

import type { Listing } from "@/types/database";

type Props = {
  listing: Listing;
  isFavorited?: boolean;
  verificationBadge?: string | null;
  avgResponseTimeHours?: number | null;
  currentUserId?: string | null;
};

function getNewLabel(createdAt: string): "vandaag" | "nieuw" | null {
  const diffHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (diffHours < NEW_LABEL_TODAY_HOURS) return "vandaag";
  if (diffHours < NEW_LABEL_RECENT_HOURS) return "nieuw";
  return null;
}

function getResponseBadge(hours: number | null | undefined): { label: string; cls: string } | null {
  if (hours == null) return null;
  if (hours < 1)   return { label: "Reageert binnen 1 uur",  cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (hours < 4)   return { label: "Reageert binnen 4 uur",  cls: "border-amber-200 bg-amber-50 text-amber-700" };
  if (hours <= 24) return { label: "Reageert binnen 24 uur", cls: "border-stone-200 bg-stone-50 text-stone-600" };
  return null;
}

export function ListingCard({ listing, isFavorited = false, verificationBadge, avgResponseTimeHours, currentUserId }: Props) {
  const isLandlordVerified = !!verificationBadge;
  const img = listing.images[0];
  const typeLabel = LISTING_TYPE_LABELS[listing.type];
  const newLabel = getNewLabel(listing.created_at);
  const responseBadge = getResponseBadge(avgResponseTimeHours);

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
            <div className="flex h-full items-center justify-center bg-stone-100">
              <svg className="h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {listing.boosted_at && (
              <BoostBadge boostedAt={listing.boosted_at} />
            )}
            {newLabel === "vandaag" && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">✦ Nieuw vandaag</span>
            )}
            {newLabel === "nieuw" && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Nieuw</span>
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

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
            {listing.type === "roommate_search" ? (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 shrink-0" />
                Huisgenoot gezocht
              </span>
            ) : (
              <span>{typeLabel}</span>
            )}
            {listing.rooms != null && <span>{listing.rooms} kamer{listing.rooms !== 1 ? "s" : ""}</span>}
            {listing.surface_area != null && <span>{listing.surface_area} m²</span>}
            {listing.availability_date && (
              <span>Vanaf {new Date(listing.availability_date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <CompareButton listingId={listing.id} />
            {verificationBadge && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Geverifieerd
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
