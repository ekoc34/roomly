import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { DetailGallery } from "@/components/listings/DetailGallery";
import { FavoriteButton } from "@/components/listings/FavoriteButton";
import { OwnerBadges } from "@/components/listings/OwnerBadges";
import { ContactButton } from "@/components/listings/ContactButton";
import { ApplicationForm } from "@/components/forms/ApplicationForm";
import { StickyApplyCTA } from "@/components/listings/StickyApplyCTA";
import { ReportListingButton } from "@/components/listings/ReportListingButton";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { Listing, Profile } from "@/types/database";

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data: ls } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (!ls) { setNotFound(true); setLoading(false); return; }
      setListing(ls as Listing);

      const [{ data: profile }, { data: fav }, { data: app }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", ls.user_id).maybeSingle(),
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id).eq("listing_id", id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from("applications").select("id").eq("listing_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setOwner((profile ?? null) as Profile | null);
      setIsFavorited(!!fav);
      setHasApplied(!!app);
      setLoading(false);
    }
    load();
  }, [id, user]);

  if (loading) return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-7 w-3/4 animate-pulse rounded-full bg-stone-200" />
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-stone-200" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    </div>
  );

  if (notFound || !listing) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-stone-100">
        <svg className="h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h1 className="mt-6 text-xl font-semibold text-stone-900">Advertentie niet gevonden</h1>
      <p className="mt-2 text-sm text-stone-500">De advertentie bestaat niet of is verwijderd.</p>
      <Link href="/kamers" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Bekijk alle woningen</Link>
    </div>
  );

  const isOwner = user?.id === listing.user_id;
  const isLoggedIn = !!user;
  const canApply = isLoggedIn && !isOwner && !hasApplied;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 pb-36 md:pb-8">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-stone-500">
        <Link href="/" className="hover:text-rose-600">Home</Link>
        <span>›</span>
        <Link href="/kamers" className="hover:text-rose-600">Woningen</Link>
        <span>›</span>
        <span className="line-clamp-1 text-stone-900 font-medium">{listing.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="relative">
            <DetailGallery images={listing.images} title={listing.title} />
            <FavoriteButton listingId={listing.id} initialFavorited={isFavorited} variant="detail" />
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                {LISTING_TYPE_LABELS[listing.type]}
              </span>
              {listing.availability_date && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Beschikbaar per {new Date(listing.availability_date).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-stone-900 sm:text-3xl leading-tight">{listing.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-stone-500">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {listing.location}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-black text-stone-900">€{Number(listing.price).toFixed(0)}</span>
              <span className="text-base text-stone-400">/ maand</span>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Beschrijving</h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{listing.description}</div>
          </div>

          {!isOwner && (
            <div id="reageer" className="scroll-mt-4">
              {canApply ? (
                <ApplicationForm listingId={listing.id} />
              ) : hasApplied ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">Je hebt al gereageerd op deze advertentie.</div>
              ) : !isLoggedIn ? (
                <div className="rounded-2xl border border-stone-200 bg-white px-5 py-5 text-center shadow-sm">
                  <p className="text-sm text-stone-600">Log in om te reageren op deze woning.</p>
                  <a href={`/inloggen?next=/kamers/${listing.id}`} className="mt-3 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</a>
                </div>
              ) : null}
            </div>
          )}

          {isOwner && (
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-5">
              <p className="text-sm font-medium text-stone-700">Dit is jouw advertentie.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/kamers/${listing.id}/bewerken`} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm hover:border-rose-200 hover:text-rose-700">Bewerken</Link>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Geplaatst op {new Date(listing.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {isLoggedIn && <ReportListingButton listingId={listing.id} isLoggedIn={isLoggedIn} />}
          </div>
        </div>

        <aside className="space-y-5">
          {!isOwner && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-2xl font-black text-stone-900">€{Number(listing.price).toFixed(0)}</span>
                <span className="text-sm text-stone-400">/ maand</span>
              </div>
              <ContactButton listingId={listing.id} />
              {!isLoggedIn && (
                <p className="mt-2 text-xs text-stone-500">
                  <Link href={`/inloggen?next=/kamers/${listing.id}`} className="font-medium text-rose-600 underline-offset-2 hover:underline">Log in</Link> om een bericht te sturen.
                </p>
              )}
            </div>
          )}
          <OwnerBadges profile={owner} memberSince={owner?.created_at ?? listing.created_at} />
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Pas op voor fraude</p>
            <ul className="mt-2 list-disc pl-4 text-xs leading-loose text-amber-800">
              <li>Maak nooit vooraf geld over</li>
              <li>Ga altijd langs voor bezichtiging</li>
              <li>Communiceer via Roomly</li>
              <li>Twijfel je? Meld de advertentie</li>
            </ul>
          </div>
        </aside>
      </div>
      <StickyApplyCTA price={listing.price} listingId={listing.id} canApply={canApply} isOwner={isOwner} isLoggedIn={isLoggedIn} />
    </div>
  );
}
