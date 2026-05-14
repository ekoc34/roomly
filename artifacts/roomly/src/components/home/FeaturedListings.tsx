import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ListingCard } from "@/components/listings/ListingCard";
import { BoostBadge, sortByBoost, BOOST_WINDOW_MS } from "@/components/listings/BoostBadge";
import type { Listing } from "@/types/database";

type RoommateProfile = {
  name: string | null;
  avatar_url: string | null;
  lifestyle_tags: string[] | null;
};

type Props = {
  listings: Listing[];
  favoriteIds: string[];
  verificationBadges?: Record<string, string | null>;
  responseTimeBadges?: Record<string, number | null>;
  roommateListings: Listing[];
  roommateProfiles: Record<string, RoommateProfile>;
  currentUserId?: string | null;
};

function isActiveBoost(boostedAt: string | null | undefined): boolean {
  if (!boostedAt) return false;
  return Date.now() - new Date(boostedAt).getTime() < BOOST_WINDOW_MS;
}

function getNewLabel(createdAt: string): "vandaag" | "nieuw" | null {
  const diffHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return "vandaag";
  if (diffHours < 72) return "nieuw";
  return null;
}

function Initials({ name }: { name: string | null }) {
  const letters = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <span className="flex h-full w-full items-center justify-center text-lg font-bold text-rose-600">
      {letters || "?"}
    </span>
  );
}

function RoommateCard({ listing, profile }: { listing: Listing; profile: RoommateProfile | undefined }) {
  const name = profile?.name ?? "Anoniem";
  const tags = profile?.lifestyle_tags ?? [];
  const newLabel = getNewLabel(listing.created_at);

  return (
    <Link
      href={`/kamers/${listing.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-4">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-rose-50 border border-rose-100">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Initials name={name} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-900">{name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-stone-500">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {listing.location}
          </p>
        </div>
        {newLabel && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${newLabel === "vandaag" ? "bg-rose-500 text-white" : "bg-stone-700 text-white"}`}>
            {newLabel === "vandaag" ? "Nieuw vandaag" : "Nieuw"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-stone-900">€{Number(listing.price).toFixed(0)}</span>
          <span className="text-xs text-stone-400">/ maand budget</span>
        </div>
        {listing.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-stone-500">{listing.description}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 self-start rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
          Bekijk profiel →
        </span>
      </div>
    </Link>
  );
}

function EmptyWoningen({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
        <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-stone-800">Geen woningen gevonden</h3>
      {!isLoggedIn && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">Er zijn momenteel nog geen advertenties. Plaats als eerste een advertentie en help het platform groeien.</p>
      )}
      {!isLoggedIn && (
        <Link href="/kamers/nieuw" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Plaats als eerste een advertentie
        </Link>
      )}
    </div>
  );
}

function EmptyHuisgenoten({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
        <svg className="h-7 w-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-stone-800">Geen huisgenotenprofielen gevonden</h3>
      {!isLoggedIn && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500">Zoek jij een huisgenoot of wil je zelf een profiel aanmaken?</p>
      )}
      {!isLoggedIn && (
        <Link href="/kamers/nieuw" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Profiel aanmaken
        </Link>
      )}
    </div>
  );
}

export function FeaturedListings({ listings, favoriteIds, verificationBadges, responseTimeBadges, roommateListings, roommateProfiles, currentUserId }: Props) {
  const [mainTab, setMainTab] = useState<"uitgelicht" | "nieuw">("uitgelicht");
  const [activeTab, setActiveTab] = useState<"woningen" | "huisgenoten">("woningen");

  // Tick re-evaluates boost expiry at the right moment
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const nextExpiry = [...listings, ...roommateListings]
      .filter((l) => l.boosted_at)
      .map((l) => new Date(l.boosted_at!).getTime() + BOOST_WINDOW_MS)
      .filter((t) => t > now)
      .reduce((min, t) => Math.min(min, t), Infinity);

    if (!isFinite(nextExpiry)) return;
    const timer = setTimeout(() => setTick((n) => n + 1), nextExpiry - now);
    return () => clearTimeout(timer);
  }, [listings, roommateListings, tick]);

  // ── Uitgelicht: only actively-boosted listings, sorted by boosted_at DESC ──
  const uitgelichtListings = useMemo(
    () =>
      listings
        .filter((l) => isActiveBoost(l.boosted_at))
        .sort((a, b) => new Date(b.boosted_at!).getTime() - new Date(a.boosted_at!).getTime()),
    [listings, tick]
  );
  const uitgelichtRoommateListings = useMemo(
    () =>
      roommateListings
        .filter((l) => isActiveBoost(l.boosted_at))
        .sort((a, b) => new Date(b.boosted_at!).getTime() - new Date(a.boosted_at!).getTime()),
    [roommateListings, tick]
  );

  // ── Nieuw: only non-boosted (or expired-boost) listings, newest first ──
  const nieuwListings = useMemo(
    () =>
      listings
        .filter((l) => !isActiveBoost(l.boosted_at))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [listings, tick]
  );
  const nieuwRoommateListings = useMemo(
    () =>
      roommateListings
        .filter((l) => !isActiveBoost(l.boosted_at))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [roommateListings, tick]
  );

  const currentListings = mainTab === "uitgelicht" ? uitgelichtListings : nieuwListings;
  const currentRoommateListings = mainTab === "uitgelicht" ? uitgelichtRoommateListings : nieuwRoommateListings;

  const mainTabClass = (tab: "uitgelicht" | "nieuw") =>
    `px-4 py-1.5 rounded-full text-sm font-semibold transition ${
      mainTab === tab
        ? "bg-stone-900 text-white shadow-sm"
        : "text-stone-500 hover:bg-stone-200"
    }`;

  const subTabClass = (tab: "woningen" | "huisgenoten") =>
    `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
      activeTab === tab
        ? "bg-rose-500 text-white shadow-sm"
        : "text-stone-600 hover:bg-stone-100"
    }`;

  return (
    <section className="mt-16" data-testid="featured-listings">
      {/* Header row: title left, main tabs right */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 sm:text-2xl">Ontdek woningen en huisgenoten</h2>
          <p className="mt-1 text-sm text-stone-500">Ontdek woningen en huisgenoten die nu beschikbaar zijn.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 p-1">
          <button type="button" onClick={() => setMainTab("uitgelicht")} className={mainTabClass("uitgelicht")}>
            ⭐ Uitgelicht
          </button>
          <button type="button" onClick={() => setMainTab("nieuw")} className={mainTabClass("nieuw")}>
            🆕 Nieuw
          </button>
        </div>
      </div>

      {/* "Alles bekijken" link */}
      <div className="mb-5 flex items-center justify-between">
        {/* Sub-tabs: Woningen / Huisgenoten */}
        <div className="flex items-center gap-2 rounded-2xl bg-stone-100 p-1 w-fit">
          <button type="button" onClick={() => setActiveTab("woningen")} className={subTabClass("woningen")}>
            🏠 Woningen
          </button>
          <button type="button" onClick={() => setActiveTab("huisgenoten")} className={subTabClass("huisgenoten")}>
            🤝 Huisgenoten
          </button>
        </div>
        <Link href="/kamers" className="text-sm font-medium text-rose-600 hover:underline">Alles bekijken →</Link>
      </div>

      {activeTab === "woningen" && (
        <>
          {currentListings.length === 0 ? (
            <EmptyWoningen isLoggedIn={!!currentUserId} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {currentListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isFavorited={favoriteIds.includes(l.id)}
                  verificationBadge={verificationBadges?.[l.user_id] ?? null}
                  avgResponseTimeHours={responseTimeBadges?.[l.user_id] ?? null}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "huisgenoten" && (
        <>
          {currentRoommateListings.length === 0 ? (
            <EmptyHuisgenoten isLoggedIn={!!currentUserId} />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {currentRoommateListings.map((l) => (
                <div key={l.id} className="relative">
                  {mainTab === "uitgelicht" && l.boosted_at && (
                    <div className="absolute right-3 top-3 z-10">
                      <BoostBadge boostedAt={l.boosted_at} />
                    </div>
                  )}
                  <RoommateCard listing={l} profile={roommateProfiles[l.user_id]} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
