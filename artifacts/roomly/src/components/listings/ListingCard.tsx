import { useState } from "react";
import { Link } from "wouter";
import { Users } from "lucide-react";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { CompareButton } from "@/components/listings/CompareButton";
import { BoostBadge, BOOST_WINDOW_MS } from "@/components/listings/BoostBadge";
import { LISTING_TYPE_LABELS, NEW_LABEL_RECENT_HOURS, NEW_LABEL_TODAY_HOURS } from "@/lib/constants";

import type { Listing } from "@/types/database";

type Props = {
  listing: Listing;
  isFavorited?: boolean;
  verificationBadge?: string | null;
  avgResponseTimeHours?: number | null;
  currentUserId?: string | null;
  ownerAvatarUrl?: string | null;
  ownerName?: string | null;
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

function OwnerAvatar({ avatarUrl, name }: { avatarUrl?: string | null; name?: string | null }) {
  return (
    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-stone-100 bg-stone-50">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <svg className="h-4 w-4 text-stone-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </span>
      )}
    </div>
  );
}

function ImagePlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-stone-50">
      <svg className="h-9 w-9 text-stone-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-[10px] text-stone-300">Geen foto</span>
    </div>
  );
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);

  if (error) return <ImagePlaceholder />;

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
      onError={() => setError(true)}
    />
  );
}

export function ListingCard({ listing, isFavorited = false, verificationBadge, avgResponseTimeHours, currentUserId, ownerAvatarUrl, ownerName }: Props) {
  const isLandlordVerified = !!verificationBadge;
  const img = listing.images[0];
  const typeLabel = LISTING_TYPE_LABELS[listing.type];
  const newLabel = getNewLabel(listing.created_at);
  const responseBadge = getResponseBadge(avgResponseTimeHours);
  const isActiveBoosted = !!(listing.boosted_at && new Date(listing.boosted_at).getTime() + BOOST_WINDOW_MS > Date.now());

  return (
    <div className={`group relative${isActiveBoosted ? " rounded-2xl shadow-[0_0_18px_rgba(251,191,36,0.18)]" : ""}`}>
      <FavoriteButton listingId={listing.id} initialFavorited={isFavorited} ownerUserId={listing.user_id} />
      <Link
        href={`/kamers/${listing.id}`}
        data-testid={`listing-card-${listing.id}`}
        className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isActiveBoosted ? "border-amber-200/70 bg-amber-50/10" : "border-stone-200/80 bg-white"}`}
      >
        <div className="relative aspect-[4/3] bg-stone-50">
          {img ? (
            <CardImage src={img} alt={listing.title} />
          ) : (
            <ImagePlaceholder />
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {newLabel === "vandaag" && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700">
                Nieuw vandaag
              </span>
            )}
            {newLabel === "nieuw" && (
              <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium tracking-wide text-stone-500">
                Nieuw
              </span>
            )}
            {listing.boosted_at && (
              <BoostBadge boostedAt={listing.boosted_at} />
            )}
            {listing.is_demo && (
              <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-100/90 px-2 py-0.5 text-[10px] font-medium tracking-wide text-stone-500 backdrop-blur-sm">
                Voorbeeldwoning
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-stone-900">€{Number(listing.price).toFixed(0)}</span>
                <span className="text-sm font-normal text-stone-400">/ maand</span>
              </div>

              <p className="mt-1 line-clamp-1 font-semibold leading-snug text-stone-800 group-hover:text-rose-600">{listing.title}</p>

              <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{listing.location}</span>
              </p>
            </div>
            <OwnerAvatar avatarUrl={ownerAvatarUrl} name={ownerName} />
          </div>

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
