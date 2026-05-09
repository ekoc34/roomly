import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingFilters } from "@/components/listings/ListingFilters";
import { SkeletonGrid } from "@/components/listings/SkeletonCard";
import type { Listing, SavedSearch } from "@/types/database";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const FILTER_KEYS = ["q", "city", "type", "district", "min", "max", "pets", "smoking", "gender", "rooms", "min_surface", "sort"] as const;

function normalizeFilters(searchString: string): Record<string, string> {
  const params = new URLSearchParams(searchString);
  const result: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const val = params.get(key);
    if (val && val !== "") result[key] = val;
  }
  return result;
}

function filtersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.join(",") !== bKeys.join(",")) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

function generateSearchName(filters: Record<string, string>): string {
  const parts: string[] = [];
  if (filters.city) parts.push(filters.city);
  if (filters.district) parts.push(filters.district);
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.type) parts.push(LISTING_TYPE_LABELS[filters.type as ListingType] ?? filters.type);
  if (filters.max && Number(filters.max) < 10000) parts.push(`max €${filters.max}`);
  if (filters.min && Number(filters.min) > 0) parts.push(`min €${filters.min}`);
  if (filters.rooms) parts.push(`${filters.rooms}+ kamers`);
  return parts.length > 0 ? parts.join(", ") : "Mijn zoekopdracht";
}

export function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [verificationMap, setVerificationMap] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const searchString = useSearch();
  const { user } = useAuth();

  const [savedSearchId, setSavedSearchId] = useState<string | null>(null);
  const [savedSearchNotify, setSavedSearchNotify] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const currentFilters = normalizeFilters(searchString);
  const hasActiveFilters = Object.keys(currentFilters).length > 0;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      if (!supabase) { setLoading(false); return; }
      const params = new URLSearchParams(searchString);
      const q = params.get("q") ?? "";
      const city = params.get("city") ?? "";
      const type = params.get("type") ?? "";
      const district = params.get("district") ?? "";
      const minPrice = Number(params.get("min") ?? 0);
      const maxPrice = Number(params.get("max") ?? 10000);
      const sort = params.get("sort") ?? "newest";
      const pets = params.get("pets") ?? "";
      const smoking = params.get("smoking") ?? "";
      const gender = params.get("gender") ?? "";
      const rooms = params.get("rooms") ?? "";
      const minSurface = params.get("min_surface") ?? "";

      let query = supabase.from("listings").select("*");

      if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
      if (type) query = query.eq("type", type);
      if (city) query = query.ilike("location", `%${city}%`);
      if (district) query = query.ilike("location", `%${district}%`);
      if (minPrice > 0) query = query.gte("price", minPrice);
      if (maxPrice < 10000) query = query.lte("price", maxPrice);
      if (pets === "1") query = query.eq("pets_allowed", true);
      if (smoking === "1") query = query.eq("smoking_allowed", true);
      if (gender) query = query.eq("gender_preference", gender);
      if (rooms) query = query.gte("rooms", Number(rooms));
      if (minSurface) query = query.gte("surface_area", Number(minSurface));

      if (sort === "cheapest") {
        query = query.order("price", { ascending: true });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const [{ data: ls }, { data: favs }] = await Promise.all([
        query,
        user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : { data: [] },
      ]);

      const fetchedListings = (ls as Listing[] | null) ?? [];
      setListings(fetchedListings);
      setFavoriteIds(((favs ?? []) as { listing_id: string }[]).map((f) => f.listing_id));

      const ownerIds = [...new Set(fetchedListings.map((l) => l.user_id))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, verification_badge")
          .in("id", ownerIds);
        const map = new Map<string, string | null>();
        for (const p of (profiles ?? []) as { id: string; verification_badge: string | null }[]) {
          map.set(p.id, p.verification_badge ?? null);
        }
        setVerificationMap(map);
      }

      setLoading(false);
    }
    fetchData();
  }, [searchString, user]);

  // Check if current search is already saved
  useEffect(() => {
    setSavedSearchId(null);
    if (!user || !supabase || !hasActiveFilters) return;
    supabase
      .from("saved_searches")
      .select("id, filters, notify")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const match = ((data as SavedSearch[] | null) ?? []).find((s) =>
          filtersEqual(s.filters as Record<string, string>, currentFilters)
        );
        if (match) {
          setSavedSearchId(match.id);
          setSavedSearchNotify(match.notify);
        }
      });
  }, [searchString, user]);

  const handleSaveSearch = useCallback(async () => {
    if (!user || !supabase) { toast.error("Log in om een zoekopdracht op te slaan."); return; }
    setIsSaving(true);
    if (savedSearchId) {
      const { error } = await supabase.from("saved_searches").delete().eq("id", savedSearchId);
      if (error) { toast.error("Verwijderen mislukt."); }
      else { setSavedSearchId(null); toast.success("Zoekopdracht verwijderd."); }
    } else {
      const name = generateSearchName(currentFilters);
      const { data, error } = await supabase
        .from("saved_searches")
        .insert({ user_id: user.id, name, filters: currentFilters, notify: savedSearchNotify })
        .select("id")
        .single();
      if (error || !data) { toast.error("Opslaan mislukt."); }
      else { setSavedSearchId((data as { id: string }).id); toast.success("Zoekopdracht opgeslagen!"); }
    }
    setIsSaving(false);
  }, [user, savedSearchId, currentFilters, savedSearchNotify]);

  const handleToggleNotify = useCallback(async () => {
    if (!user || !supabase) return;
    const next = !savedSearchNotify;
    setSavedSearchNotify(next);
    if (savedSearchId) {
      await supabase.from("saved_searches").update({ notify: next }).eq("id", savedSearchId);
      toast.success(next ? "Notificaties aan." : "Notificaties uit.");
    }
  }, [savedSearchId, savedSearchNotify, user]);

  const params = new URLSearchParams(searchString);
  const q = params.get("q") ?? "";
  const mapHref = searchString ? `/kaart?${searchString}` : "/kaart";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Helmet>
        <title>{q ? `"${q}" — Woningen` : "Alle woningen"} — Roomly</title>
        <meta name="description" content="Doorzoek honderden kamers en woningen in Nederland. Filter op prijs, type, stad en meer." />
      </Helmet>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
            {q ? `Resultaten voor "${q}"` : "Alle woningen"}
          </h1>
          <p className="text-sm text-stone-500">{loading ? "Laden…" : `${listings.length} woning${listings.length !== 1 ? "en" : ""} gevonden`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Save search button — only shown when there are active filters */}
          {user && hasActiveFilters && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSaveSearch}
                disabled={isSaving}
                className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition disabled:opacity-50 ${
                  savedSearchId
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-stone-200 bg-white text-stone-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                <svg className="h-4 w-4" fill={savedSearchId ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {savedSearchId ? "Zoekopdracht verwijderen" : "Sla zoekopdracht op"}
              </button>
              {/* Bell notify toggle — only shown after saving */}
              {savedSearchId && (
                <button
                  type="button"
                  onClick={handleToggleNotify}
                  title={savedSearchNotify ? "Notificaties uit" : "Notificaties aan"}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                    savedSearchNotify
                      ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "border-stone-200 bg-white text-stone-400 hover:bg-stone-50"
                  }`}
                >
                  <svg className="h-4 w-4" fill={savedSearchNotify ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <Link
            href={mapHref}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Bekijk op kaart
          </Link>
        </div>
      </div>
      <ListingFilters />
      <div className="mt-6">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-20 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-7 w-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-stone-800">
              {q ? `Geen resultaten gevonden voor "${q}"` : "Geen woningen gevonden"}
            </h3>
            <p className="mt-2 text-sm text-stone-500">Probeer andere filters of zoekterm.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} isFavorited={favoriteIds.includes(l.id)} verificationBadge={verificationMap.get(l.user_id) ?? null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
