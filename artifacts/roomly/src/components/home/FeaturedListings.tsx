import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ListingCard } from "@/components/listings/ListingCard";
import { BOOST_WINDOW_MS } from "@/components/listings/BoostBadge";
import type { Listing, UserType } from "@/types/database";

type RoommateProfile = {
  name: string | null;
  avatar_url: string | null;
  lifestyle_tags: string[] | null;
};

type OwnerProfile = {
  name: string | null;
  avatar_url: string | null;
};

type Props = {
  listings: Listing[];
  favoriteIds: string[];
  verificationBadges?: Record<string, string | null>;
  responseTimeBadges?: Record<string, number | null>;
  roommateListings: Listing[];
  roommateProfiles: Record<string, RoommateProfile>;
  ownerProfiles?: Record<string, OwnerProfile>;
  currentUserId?: string | null;
  userType?: UserType | null;
};

function isActiveBoost(boostedAt: string | null | undefined): boolean {
  if (!boostedAt) return false;
  return Date.now() - new Date(boostedAt).getTime() < BOOST_WINDOW_MS;
}


function EmptyState({
  section,
  mainTab,
  isLoggedIn,
  userType,
}: {
  section: "woningen" | "huisgenoten";
  mainTab: "uitgelicht" | "nieuw";
  isLoggedIn: boolean;
  userType?: UserType | null;
}) {
  const isVerhuurder = userType === "verhuurder";
  const isHuisgenotenZoeker = userType === "huisgenoot_zoeker";

  let title: string;
  let sub: string;
  let cta: { label: string; href: string } | null = null;

  if (section === "woningen") {
    if (mainTab === "uitgelicht") {
      title = "Nog geen uitgelichte woningen";
      if (!isLoggedIn) {
        sub = "Maak een account aan om sneller te reageren en favorieten op te slaan.";
      } else if (isVerhuurder) {
        sub = "Boost een van je advertenties om hier zichtbaar te worden.";
        cta = { label: "Naar mijn dashboard", href: "/dashboard" };
      } else {
        sub = "Schakel over naar de Nieuw-tab voor recente advertenties.";
      }
    } else {
      title = "Nog geen nieuwe woningen gevonden";
      if (!isLoggedIn) {
        sub = "Maak een account aan om meldingen te ontvangen zodra er nieuwe woningen beschikbaar zijn.";
        cta = { label: "Account aanmaken", href: "/registreren" };
      } else if (isVerhuurder) {
        sub = "Plaats een advertentie om hier zichtbaar te worden.";
        cta = { label: "Advertentie plaatsen", href: "/kamers/nieuw" };
      } else {
        sub = "Probeer een andere stad of bekijk het volledige aanbod op de zoekpagina.";
        cta = { label: "Alle woningen bekijken", href: "/kamers" };
      }
    }
  } else {
    if (mainTab === "uitgelicht") {
      title = "Nog geen uitgelichte profielen";
      if (!isLoggedIn) {
        sub = "Maak een account aan om huisgenoten te vinden en contact op te nemen.";
      } else if (isHuisgenotenZoeker) {
        sub = "Boost je profiel om hier zichtbaar te worden.";
        cta = { label: "Naar mijn dashboard", href: "/dashboard" };
      } else {
        sub = "Schakel over naar de Nieuw-tab voor recente huisgenotenprofielen.";
      }
    } else {
      title = "Nog geen nieuwe profielen gevonden";
      if (!isLoggedIn) {
        sub = "Maak een account aan om huisgenoten te ontdekken en contact op te nemen.";
        cta = { label: "Account aanmaken", href: "/registreren" };
      } else if (isHuisgenotenZoeker) {
        sub = "Maak een profiel aan om op zoek te gaan naar een geschikte huisgenoot.";
        cta = { label: "Profiel plaatsen", href: "/kamers/nieuw" };
      } else {
        sub = "Er zijn momenteel geen recente profielen. Kom later terug of bekijk de beschikbare woningen.";
        cta = { label: "Woningen bekijken", href: "/kamers" };
      }
    }
  }

  const icon =
    section === "woningen" ? (
      <svg className="h-4 w-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/30 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-100 bg-white shadow-sm">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-stone-600">{title}</p>
      <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-stone-400">{sub}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 text-xs font-medium text-stone-500 transition hover:text-stone-800"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

const HomeIcon = () => (
  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const StarIconSm = () => (
  <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

export function FeaturedListings({ listings, favoriteIds, verificationBadges, responseTimeBadges, roommateListings, roommateProfiles, ownerProfiles, currentUserId, userType }: Props) {
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
    `inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition ${
      mainTab === tab
        ? "bg-white text-stone-800 shadow-sm"
        : "text-stone-400 hover:text-stone-600"
    }`;

  const subTabClass = (tab: "woningen" | "huisgenoten") =>
    `inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
      activeTab === tab
        ? "bg-white text-stone-800 shadow-sm"
        : "text-stone-500 hover:text-stone-700"
    }`;

  return (
    <section className="mt-16" data-testid="featured-listings">
      {/* Header row: title left, main switch right */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900 sm:text-2xl">Ontdek woningen en huisgenoten</h2>
          <p className="mt-1 text-sm text-stone-400">Bekijk het aanbod dat nu beschikbaar is.</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-stone-100 p-1">
          <button type="button" onClick={() => setMainTab("uitgelicht")} className={mainTabClass("uitgelicht")}>
            <StarIconSm />
            Uitgelicht
          </button>
          <button type="button" onClick={() => setMainTab("nieuw")} className={mainTabClass("nieuw")}>
            <SparkleIcon />
            Nieuw
          </button>
        </div>
      </div>

      {/* Sub-tabs row */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-xl bg-stone-100 p-1">
          <button type="button" onClick={() => setActiveTab("woningen")} className={subTabClass("woningen")}>
            <HomeIcon />
            Woningen
          </button>
          <button type="button" onClick={() => setActiveTab("huisgenoten")} className={subTabClass("huisgenoten")}>
            <UsersIcon />
            Huisgenoten
          </button>
        </div>
        <Link href="/kamers" className="text-xs font-medium text-stone-400 transition hover:text-stone-600">Alles bekijken →</Link>
      </div>

      {activeTab === "woningen" && (
        <>
          {currentListings.length === 0 ? (
            <EmptyState section="woningen" mainTab={mainTab} isLoggedIn={!!currentUserId} userType={userType} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {currentListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isFavorited={favoriteIds.includes(l.id)}
                  verificationBadge={verificationBadges?.[l.user_id] ?? null}
                  avgResponseTimeHours={responseTimeBadges?.[l.user_id] ?? null}
                  currentUserId={currentUserId}
                  ownerAvatarUrl={ownerProfiles?.[l.user_id]?.avatar_url ?? null}
                  ownerName={ownerProfiles?.[l.user_id]?.name ?? null}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "huisgenoten" && (
        <>
          {currentRoommateListings.length === 0 ? (
            <EmptyState section="huisgenoten" mainTab={mainTab} isLoggedIn={!!currentUserId} userType={userType} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {currentRoommateListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  isFavorited={favoriteIds.includes(l.id)}
                  verificationBadge={verificationBadges?.[l.user_id] ?? null}
                  avgResponseTimeHours={responseTimeBadges?.[l.user_id] ?? null}
                  currentUserId={currentUserId}
                  ownerAvatarUrl={roommateProfiles[l.user_id]?.avatar_url ?? null}
                  ownerName={roommateProfiles[l.user_id]?.name ?? null}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
