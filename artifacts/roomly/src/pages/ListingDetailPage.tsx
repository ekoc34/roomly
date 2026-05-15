import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
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
import { SimilarLandlords } from "@/components/listings/SimilarLandlords";
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

      if (user && supabase) {
        supabase
          .from("listing_views")
          .upsert(
            { user_id: user.id, listing_id: params.id, viewed_at: new Date().toISOString() },
            { onConflict: "user_id,listing_id" }
          )
          .then(({ error }) => {
            if (error) console.error("[listing_views] upsert failed:", error.message);
          });
      }
    }
    fetchData();
  }, [params.id, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-7 w-2/3 animate-pulse rounded-full bg-stone-200" />
            <div className="h-4 w-1/3 animate-pulse rounded-full bg-stone-200" />
          </div>
          <div className="space-y-3">
            <div className="h-36 animate-pulse rounded-2xl bg-stone-200" />
            <div className="h-12 animate-pulse rounded-2xl bg-stone-200" />
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

  // Compact metadata chips
  const metaChips: { label: string; value: string; highlight?: boolean }[] = [];
  if (listing.rooms != null) metaChips.push({ label: "kamers", value: String(listing.rooms) });
  if (listing.surface_area != null) metaChips.push({ label: "m²", value: String(listing.surface_area) });
  if (listing.gender_preference) {
    const gLabel = listing.gender_preference === "man" ? "Alleen mannen" : listing.gender_preference === "vrouw" ? "Alleen vrouwen" : "Gemengd";
    metaChips.push({ label: gLabel, value: "" });
  }
  if (listing.pets_allowed != null) metaChips.push({ label: listing.pets_allowed ? "Huisdieren ok" : "Geen huisdieren", value: "", highlight: !!listing.pets_allowed });
  if (listing.smoking_allowed != null) metaChips.push({ label: listing.smoking_allowed ? "Roken ok" : "Niet roken", value: "", highlight: !!listing.smoking_allowed });

  return (
    <>
      <Helmet>
        <title>{listing.title} — Welkthuis.nl</title>
      </Helmet>
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        {showLandlordPanel && (
          <ApplicantProfilePanel
            profileId={listing.user_id}
            mode="landlord"
            viewerUserId={user?.id}
            currentListingId={listing.id}
            onClose={() => setShowLandlordPanel(false)}
          />
        )}

        <nav className="mb-4 flex items-center gap-2 text-sm text-stone-400">
          <Link href="/kamers" className="hover:text-rose-600">Woningen</Link>
          <span>›</span>
          <span className="truncate text-stone-600">{listing.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          {/* Main column */}
          <div className="space-y-5">
            {/* Gallery */}
            <div className="relative">
              <DetailGallery images={listing.images} title={listing.title} />
              <FavoriteButton listingId={listing.id} initialFavorited={favorited} variant="detail" ownerUserId={listing.user_id} />
            </div>

            {/* Title block */}
            <div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-600">{typeLabel}</span>
                {listing.availability_date && (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Beschikbaar per {new Date(listing.availability_date).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-2xl font-bold leading-snug text-stone-900 sm:text-3xl">{listing.title}</h1>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.location}
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-xs">{new Date(listing.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>

              <div className="mt-3 text-3xl font-black text-stone-900">
                €{Number(listing.price).toFixed(0)}<span className="ml-1 text-base font-normal text-stone-400">/ maand</span>
              </div>
            </div>

            {/* Metadata chips — compact horizontal row */}
            {metaChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {metaChips.map((chip, i) => (
                  <span
                    key={i}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      chip.highlight
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-stone-200 bg-stone-50 text-stone-600"
                    }`}
                  >
                    {chip.value ? `${chip.value} ${chip.label}` : chip.label}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-stone-900 prose-p:text-stone-600 prose-p:leading-relaxed">
              <h3>Beschrijving</h3>
              {listing.description.split("\n").filter(Boolean).map((par, i) => (
                <p key={i}>{par}</p>
              ))}
            </div>

            {/* House rules (if any) */}
            {listing.house_rules && (
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-stone-500">Huisregels</p>
                <p className="text-sm leading-relaxed text-stone-600">{listing.house_rules}</p>
              </div>
            )}

            {/* Report — quiet, at the bottom */}
            <div className="border-t border-stone-100 pt-3">
              <ReportListingButton listingId={listing.id} isLoggedIn={isLoggedIn} />
            </div>
          </div>

          {/* Sidebar — sticky on desktop */}
          <div className="space-y-3 lg:sticky lg:top-24 lg:h-fit">
            <OwnerBadges
              profile={owner}
              memberSince={owner?.created_at ?? listing.created_at}
              onNameClick={owner ? () => setShowLandlordPanel(true) : undefined}
            />

            {/* Primary CTA lives in the sidebar on desktop */}
            {!isOwner && isLoggedIn && (
              <div id="reageer">
                <ApplicationForm listingId={listing.id} />
              </div>
            )}
            {!isOwner && !isLoggedIn && (
              <a
                href={`/inloggen?next=/kamers/${listing.id}`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                </svg>
                Inloggen om te reageren
              </a>
            )}
            {isOwner && (
              <Link
                href={`/kamers/${listing.id}/bewerken`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Advertentie bewerken
              </Link>
            )}
          </div>
        </div>

        <SimilarLandlords
          location={listing.location}
          excludeUserId={listing.user_id}
          viewerUserId={user?.id}
        />

        <StickyApplyCTA price={listing.price} listingId={listing.id} canApply={isLoggedIn && !isOwner} isOwner={isOwner} isLoggedIn={isLoggedIn} />
      </div>
    </>
  );
}
