import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { DetailGallery } from "@/components/listings/DetailGallery";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { OwnerBadges } from "@/components/listings/OwnerBadges";
import { ReportListingButton } from "@/components/listings/ReportListingButton";
import { StickyApplyCTA } from "@/components/listings/StickyApplyCTA";
import { ApplicationForm } from "@/components/listings/ApplicationForm";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { Listing, Profile } from "@/types/database";

export function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showLandlordPanel, setShowLandlordPanel] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!supabase) { setLoading(false); return; }
      const { data: l } = await supabase.from("listings").select("*").eq("id", params.id).maybeSingle();
      if (!l) { setNotFound(true); setLoading(false); return; }
      setListing(l as Listing);
      const [{ data: ownerProfile }, { data: fav }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", (l as Listing).user_id).maybeSingle(),
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id).eq("listing_id", params.id).maybeSingle() : { data: null },
      ]);
      setOwner(ownerProfile as Profile | null);
      setFavorited(!!fav);
      setLoading(false);
    }
    fetchData();
  }, [params.id, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-8 w-2/3 animate-pulse rounded-full bg-stone-200" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-stone-200" />
          </div>
          <div className="space-y-4">
            <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-6xl font-black text-stone-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">Advertentie niet gevonden</h1>
        <p className="mt-2 text-sm text-stone-500">De advertentie die je zoekt bestaat niet of is verwijderd.</p>
        <Link href="/kamers" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Terug naar overzicht</Link>
      </div>
    );
  }

  const isOwner = user?.id === listing.user_id;
  const isLoggedIn = !!user;
  const typeLabel = LISTING_TYPE_LABELS[listing.type];
  const isLandlordVerified = !!(owner?.phone_verified || owner?.email_auto_verified || owner?.student_verified || owner?.verification_badge);
  const verificationBadgeLabel = owner?.verification_badge || (isLandlordVerified ? "Geverifieerde verhuurder" : null);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6 lg:px-8 lg:pb-8">
      {showLandlordPanel && (
        <ApplicantProfilePanel
          profileId={listing.user_id}
          mode="landlord"
          onClose={() => setShowLandlordPanel(false)}
        />
      )}
      <nav className="mb-4 flex items-center gap-2 text-sm text-stone-500">
        <Link href="/kamers" className="hover:text-rose-600">Woningen</Link>
        <span>›</span>
        <span className="truncate text-stone-700">{listing.title}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="relative">
            <DetailGallery images={listing.images} title={listing.title} />
            <FavoriteButton listingId={listing.id} initialFavorited={favorited} variant="detail" />
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">{typeLabel}</span>
              {listing.availability_date && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Beschikbaar per {new Date(listing.availability_date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-snug text-stone-900 sm:text-3xl">{listing.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {listing.location}
              </span>
              <span className="text-stone-300">·</span>
              <span>Geplaatst op {new Date(listing.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div className="mt-4 text-3xl font-black text-stone-900">
              €{Number(listing.price).toFixed(0)}<span className="ml-1 text-base font-normal text-stone-400">/ maand</span>
            </div>
          </div>

          {(listing.rooms != null || listing.surface_area != null || listing.gender_preference || listing.pets_allowed != null || listing.smoking_allowed != null) && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:grid-cols-3">
              {listing.rooms != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-stone-400">Kamers</span>
                  <span className="text-sm font-semibold text-stone-800">{listing.rooms}</span>
                </div>
              )}
              {listing.surface_area != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-stone-400">Oppervlakte</span>
                  <span className="text-sm font-semibold text-stone-800">{listing.surface_area} m²</span>
                </div>
              )}
              {listing.gender_preference && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-stone-400">Gender voorkeur</span>
                  <span className="text-sm font-semibold text-stone-800">
                    {listing.gender_preference === "man" ? "Alleen mannen" : listing.gender_preference === "vrouw" ? "Alleen vrouwen" : "Gemengd"}
                  </span>
                </div>
              )}
              {listing.pets_allowed != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-stone-400">Huisdieren</span>
                  <span className={`text-sm font-semibold ${listing.pets_allowed ? "text-emerald-700" : "text-stone-500"}`}>
                    {listing.pets_allowed ? "Toegestaan" : "Niet toegestaan"}
                  </span>
                </div>
              )}
              {listing.smoking_allowed != null && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-stone-400">Roken</span>
                  <span className={`text-sm font-semibold ${listing.smoking_allowed ? "text-emerald-700" : "text-stone-500"}`}>
                    {listing.smoking_allowed ? "Toegestaan" : "Niet toegestaan"}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-stone-900 prose-p:text-stone-600 prose-p:leading-relaxed">
            <h3>Beschrijving</h3>
            {listing.description.split("\n").filter(Boolean).map((par, i) => (
              <p key={i}>{par}</p>
            ))}
          </div>

          <div className="flex flex-col gap-4 pt-2" id="reageer">
            {!isOwner && isLoggedIn && <ApplicationForm listingId={listing.id} />}
            {!isOwner && !isLoggedIn && (
              <a href={`/inloggen?next=/kamers/${listing.id}`} className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg>
                Inloggen om te reageren
              </a>
            )}
            {isOwner && (
              <Link href={`/kamers/${listing.id}/bewerken`} className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-95">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Advertentie bewerken
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 pt-3">
            <ReportListingButton listingId={listing.id} isLoggedIn={isLoggedIn} />
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          {owner && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLandlordPanel(true)}
                className="text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline"
              >
                {owner.name || "Roomly gebruiker"}
              </button>
              {verificationBadgeLabel && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {verificationBadgeLabel}
                </span>
              )}
            </div>
          )}
          <OwnerBadges profile={owner} memberSince={owner?.created_at ?? listing.created_at} />
          {isOwner && (
            <Link href={`/kamers/${listing.id}/bewerken`} className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Bewerk mijn advertentie
            </Link>
          )}
        </div>
      </div>
      <StickyApplyCTA price={listing.price} listingId={listing.id} canApply={isLoggedIn && !isOwner} isOwner={isOwner} isLoggedIn={isLoggedIn} />
    </div>
  );
}
