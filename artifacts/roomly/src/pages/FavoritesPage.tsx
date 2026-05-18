import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ListingCard } from "@/components/listings/ListingCard";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import type { Listing } from "@/types/database";

export function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [listings, setListings] = useState<Listing[]>([]);
  const [verificationBadges, setVerificationBadges] = useState<Record<string, string | null>>({});
  const [responseTimeBadges, setResponseTimeBadges] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }
    async function fetchFavs() {
      const { data } = await supabase!.from("favorites").select("listing_id, listings(*)").eq("user_id", user!.id);
      const ls = (data ?? []).map((row: { listings: Listing }) => row.listings).filter(Boolean) as Listing[];
      setListings(ls);

      const ownerIds = [...new Set(ls.map((l) => l.user_id))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase!
          .from("profiles")
          .select("id, email_auto_verified, phone_verified, avg_response_time_hours")
          .in("id", ownerIds);
        const badgeMap: Record<string, string | null> = {};
        const rtMap: Record<string, number | null> = {};
        for (const p of (profiles ?? []) as { id: string; email_auto_verified: boolean; phone_verified: boolean; avg_response_time_hours: number | null }[]) {
          badgeMap[p.id] = p.email_auto_verified && p.phone_verified ? "Geverifieerd" : null;
          rtMap[p.id] = p.avg_response_time_hours ?? null;
        }
        setVerificationBadges(badgeMap);
        setResponseTimeBadges(rtMap);
      }
      setLoading(false);
    }
    fetchFavs();
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
          <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">{t("favorites.loginRequired")}</h1>
        <p className="mt-2 text-sm text-stone-500">{t("favorites.loginRequiredDesc")}</p>
        <Link href="/inloggen?next=/favorieten" data-testid="favorites-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">{t("favorites.loginBtn")}</Link>
      </div>
    );
  }

  const countLabel = listings.length === 1
    ? t("favorites.savedCount").replace("{count}", String(listings.length))
    : t("favorites.savedCountPlural").replace("{count}", String(listings.length));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{t("favorites.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{!loading && countLabel}</p>
      </div>
      {loading ? (
        <SkeletonGrid count={6} />
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-20 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <svg className="h-7 w-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-stone-800">{t("favorites.empty")}</h3>
          <p className="mt-2 max-w-sm text-sm text-stone-500">{t("favorites.emptyDesc")}</p>
          <Link href="/kamers" className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">{t("favorites.browseListings")}</Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} isFavorited={true} verificationBadge={verificationBadges[l.user_id] ?? null} avgResponseTimeHours={responseTimeBadges[l.user_id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
