import { useState, useEffect, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ShieldAlert, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LISTING_TYPE_LABELS, CITY_DISTRICTS } from "@/lib/constants";
import { ListingImageUpload } from "@/components/listings/ListingImageUpload";
import { isFullyVerified } from "@/lib/verificationUtils";
import { mapRpcError } from "@/lib/rpcErrors";
import type { ListingType, SavedSearch, Profile } from "@/types/database";

const BANNER_DISMISSED_KEY = "roomly_verify_banner_dismissed";

const ALL_TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

function getAvailableTypes(userType: string | null | undefined): ListingType[] {
  if (userType === "verhuurder") return ["room_for_rent", "short_stay"];
  if (userType === "huisgenoot_zoeker") return ["roommate_search"];
  return ALL_TYPES;
}

const DUTCH_CITIES = [
  "Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven",
  "Groningen", "Maastricht", "Leiden", "Delft", "Tilburg",
  "Breda", "Nijmegen", "Arnhem", "Haarlem", "'s-Hertogenbosch",
];

const inputClass = "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
const selectClass = "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
const labelClass = "text-xs font-medium text-stone-700";

type NewListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  type: string;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  gender_preference: string | null;
  rooms: number | null;
  surface_area: number | null;
};

function listingMatchesFilters(listing: NewListing, filters: Record<string, string>): boolean {
  const q          = filters.q ?? "";
  const city       = filters.city ?? "";
  const district   = filters.district ?? "";
  const filterType = filters.type ?? "";
  const minPrice   = Number(filters.min ?? 0);
  const maxPrice   = Number(filters.max ?? 10000);
  const pets       = filters.pets ?? "";
  const smoking    = filters.smoking ?? "";
  const gender     = filters.gender ?? "";
  const rooms      = filters.rooms ?? "";
  const minSurface = filters.min_surface ?? "";

  // Free-text search across title, description and location
  if (q && !`${listing.title} ${listing.description} ${listing.location}`.toLowerCase().includes(q.toLowerCase())) return false;
  // City — listing location format is "Amsterdam" or "Amsterdam, Centrum"
  if (city && !listing.location.toLowerCase().includes(city.toLowerCase())) return false;
  // District / stadsdeel
  if (district && !listing.location.toLowerCase().includes(district.toLowerCase())) return false;
  // Listing type (room_for_rent, roommate_search, short_stay)
  if (filterType && listing.type !== filterType) return false;
  // Price range
  if (minPrice > 0 && listing.price < minPrice) return false;
  if (maxPrice < 10000 && listing.price > maxPrice) return false;
  // Amenity flags — only filter when explicitly set
  if (pets === "1" && !listing.pets_allowed) return false;
  if (smoking === "1" && !listing.smoking_allowed) return false;
  // Gender preference — exact match
  if (gender && listing.gender_preference !== gender) return false;
  // Minimum rooms
  if (rooms && (listing.rooms == null || listing.rooms < Number(rooms))) return false;
  // Minimum surface area
  if (minSurface && (listing.surface_area == null || listing.surface_area < Number(minSurface))) return false;
  return true;
}

async function notifyMatchingSavedSearches(listing: NewListing, ownerId: string) {
  if (!supabase) return;
  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("notify", true)
    .neq("user_id", ownerId);

  const matches = ((savedSearches as SavedSearch[] | null) ?? []).filter((s) =>
    listingMatchesFilters(listing, s.filters as Record<string, string>)
  );

  if (matches.length === 0) return;

  // Fetch notification preferences for all matching users in one query
  const matchingUserIds = [...new Set(matches.map((s) => s.user_id))];
  const { data: prefsData } = await supabase!
    .from("profiles")
    .select("id, notify_matching_listing")
    .in("id", matchingUserIds);
  const prefsMap = new Map(
    ((prefsData ?? []) as { id: string; notify_matching_listing: boolean | null }[]).map((p) => [p.id, p.notify_matching_listing])
  );

  const now = new Date().toISOString();
  await Promise.all(
    matches.map(async (s) => {
      const wantsNotif = prefsMap.get(s.user_id) !== false;
      await Promise.all([
        wantsNotif
          ? supabase!.from("notifications").insert({
              user_id: s.user_id,
              type: "new_matching_listing",
              title: "Nieuwe woning gevonden!",
              body: `"${listing.title}" in ${listing.location} matcht met je opgeslagen zoekopdracht "${s.name}".`,
              related_id: listing.id,
            })
          : Promise.resolve(),
        supabase!
          .from("saved_searches")
          .update({ last_matched_at: now })
          .eq("id", s.id),
      ]);
    })
  );
}

export function NewListingPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeListingCount, setActiveListingCount] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === "1"
  );

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(async ({ data }) => {
      const p = data as Profile | null;
      setProfile(p);
      const allowed = ["verhuurder", "huisgenoot_zoeker"];
      if (p && p.user_type && !allowed.includes(p.user_type)) {
        toast.error("Je hebt geen toegang om advertenties te plaatsen.");
        navigate("/dashboard");
        return;
      }
      // Fetch listing count for free-tier limit check (admins and premium users are exempt)
      if (p && p.role !== "admin" && (!p.subscription_tier || p.subscription_tier === "free")) {
        const { count } = await supabase!
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setActiveListingCount(count ?? 0);
      }
    });
  }, [user]);

  const dismissBanner = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setBannerDismissed(true);
  };

  const showVerifyBanner = !bannerDismissed && !!user && !isFullyVerified(profile);

  const availableDistricts = city ? (CITY_DISTRICTS[city.toLowerCase()] ?? []) : [];

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value);
    setDistrict("");
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om een advertentie te plaatsen</h1>
        <Link href="/inloggen?next=/kamers/nieuw" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  // Free-tier listing limit gate — temporarily disabled.
  // Re-enable isFreeUser + limitReached + the return block below to restore the cap.

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const price = Number(fd.get("price") ?? 0);
    const location = city
      ? district ? `${city}, ${district}` : city
      : String(fd.get("location_fallback") ?? "").trim();
    const type = String(fd.get("type") ?? "room_for_rent") as ListingType;
    const availability_date = String(fd.get("availability_date") ?? "").trim() || null;
    const roomsRaw = String(fd.get("rooms") ?? "").trim();
    const rooms = roomsRaw !== "" ? Number(roomsRaw) : null;
    const surfaceRaw = String(fd.get("surface_area") ?? "").trim();
    const surface_area = surfaceRaw !== "" ? Number(surfaceRaw) : null;
    const genderRaw = String(fd.get("gender_preference") ?? "");
    const gender_preference = genderRaw === "" ? null : genderRaw as "man" | "vrouw" | "gemengd";

    if (!title || !description || !location || price <= 0) {
      setError("Vul alle verplichte velden in (titel, beschrijving, stad, prijs).");
      return;
    }
    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }
      const { data: listingId, error: err } = await supabase.rpc("create_listing", {
        p_data: {
          title,
          description,
          price,
          location,
          type,
          images,
          availability_date: availability_date ?? "",
          pets_allowed: petsAllowed,
          smoking_allowed: smokingAllowed,
          gender_preference: gender_preference ?? "",
          rooms: rooms != null ? String(rooms) : "",
          surface_area: surface_area != null ? String(surface_area) : "",
        },
      });
      if (err || !listingId) {
        setError(mapRpcError(err, "Advertentie kon niet worden geplaatst. Probeer opnieuw."));
        return;
      }
      toast.success("Advertentie geplaatst!");

      notifyMatchingSavedSearches(
        { id: listingId, title, description, price, location, type, pets_allowed: petsAllowed, smoking_allowed: smokingAllowed, gender_preference, rooms, surface_area },
        user.id
      );

      navigate(`/kamers/${listingId}`);
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Advertentie plaatsen</span>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900">Advertentie plaatsen</h1>
      <p className="mt-1 text-sm text-stone-500">Gratis — bereik duizenden huurders in heel Nederland.</p>
      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={onSubmit} className="space-y-5" data-testid="new-listing-form">
          {showVerifyBanner && (
            <div className="relative rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 pr-10">
              <button
                type="button"
                onClick={dismissBanner}
                aria-label="Sluiten"
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-amber-400 transition hover:bg-amber-100 hover:text-amber-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">Vergroot je kans op reacties</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-700">
                    Geverifieerde accounts krijgen meer vertrouwen. Verifieer je e-mail en telefoonnummer voor een grotere kans op reacties.
                  </p>
                  <Link
                    href="/profiel"
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Verifiëren
                  </Link>
                </div>
              </div>
            </div>
          )}
          <div>
            <label htmlFor="nl-title" className={labelClass}>Titel *</label>
            <input id="nl-title" name="title" type="text" required maxLength={72} placeholder="Bijv. Ruime kamer in Amsterdam-Oost, 14m²" className={inputClass} data-testid="new-listing-title" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nl-type" className={labelClass}>Type</label>
              <select id="nl-type" name="type" className={selectClass} data-testid="new-listing-type">
                {getAvailableTypes(profile?.user_type).map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="nl-price" className={labelClass}>Prijs per maand (€) *</label>
              <input id="nl-price" name="price" type="number" required min={1} step={1} placeholder="800" className={inputClass} data-testid="new-listing-price" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nl-city" className={labelClass}>Stad *</label>
              <select
                id="nl-city"
                value={city}
                onChange={handleCityChange}
                className={selectClass}
                data-testid="new-listing-city"
              >
                <option value="">Kies een stad…</option>
                {DUTCH_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nl-district" className={labelClass}>Stadsdeel / wijk</label>
              <select
                id="nl-district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={availableDistricts.length === 0}
                className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                data-testid="new-listing-district"
              >
                <option value="">{availableDistricts.length === 0 ? "Kies eerst een stad" : "Heel de stad"}</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nl-avail" className={labelClass}>Beschikbaar per</label>
              <input id="nl-avail" name="availability_date" type="date" className={inputClass} data-testid="new-listing-avail" />
            </div>
            <div>
              <label htmlFor="nl-gender" className={labelClass}>Gender voorkeur</label>
              <select id="nl-gender" name="gender_preference" className={selectClass}>
                <option value="">Geen voorkeur</option>
                <option value="man">Alleen mannen</option>
                <option value="vrouw">Alleen vrouwen</option>
                <option value="gemengd">Gemengd</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nl-rooms" className={labelClass}>Aantal kamers</label>
              <input id="nl-rooms" name="rooms" type="number" min={0} step={1} placeholder="bijv. 3" className={inputClass} />
            </div>
            <div>
              <label htmlFor="nl-surface" className={labelClass}>Woonoppervlakte</label>
              <div className="relative mt-1.5">
                <input id="nl-surface" name="surface_area" type="number" min={0} step={1} placeholder="bijv. 20" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-4 pr-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400">m²</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Huisregels</p>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-sm text-stone-700">Huisdieren toegestaan</span>
              <button
                type="button"
                role="switch"
                aria-checked={petsAllowed}
                onClick={() => setPetsAllowed((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1 ${petsAllowed ? "bg-rose-500" : "bg-stone-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${petsAllowed ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-sm text-stone-700">Roken toegestaan</span>
              <button
                type="button"
                role="switch"
                aria-checked={smokingAllowed}
                onClick={() => setSmokingAllowed((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1 ${smokingAllowed ? "bg-rose-500" : "bg-stone-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${smokingAllowed ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
          </div>

          <div>
            <label htmlFor="nl-desc" className={labelClass}>Beschrijving *</label>
            <textarea id="nl-desc" name="description" required rows={6} maxLength={4000} placeholder="Omschrijf de woning, huurder, voorzieningen en buurt…" className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-description" />
          </div>
          <ListingImageUpload value={images} onChange={setImages} />

          {(profile?.user_type === "verhuurder" || profile?.user_type === "huisgenoot_zoeker") && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Promotie</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-900">Advertentie uitlichten</p>
                  <p className="mt-0.5 text-xs text-amber-700">Jouw advertentie verschijnt bovenaan de aanbevolen woningen op de homepage.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={boosted}
                  onClick={() => setBoosted((v) => !v)}
                  className={`relative ml-4 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 ${boosted ? "bg-amber-500" : "bg-stone-300"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${boosted ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </label>
            </div>
          )}

          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={isPending} data-testid="new-listing-submit" className="flex-1 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
              {isPending ? "Bezig…" : "Advertentie plaatsen"}
            </button>
            <Link href="/dashboard" className="rounded-2xl border border-stone-200 px-5 py-3 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">Annuleren</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
