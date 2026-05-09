import { useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LISTING_TYPE_LABELS, CITY_DISTRICTS } from "@/lib/constants";
import { ListingImageUpload } from "@/components/listings/ListingImageUpload";
import type { ListingType, SavedSearch } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

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
  const q = filters.q ?? "";
  const filterType = filters.type ?? "";
  const district = filters.district ?? "";
  const minPrice = Number(filters.min ?? 0);
  const maxPrice = Number(filters.max ?? 10000);
  const pets = filters.pets ?? "";
  const smoking = filters.smoking ?? "";
  const gender = filters.gender ?? "";
  const rooms = filters.rooms ?? "";
  const minSurface = filters.min_surface ?? "";

  if (q && !`${listing.title} ${listing.description} ${listing.location}`.toLowerCase().includes(q.toLowerCase())) return false;
  if (filterType && listing.type !== filterType) return false;
  if (district && !listing.location.toLowerCase().includes(district.toLowerCase())) return false;
  if (minPrice > 0 && listing.price < minPrice) return false;
  if (maxPrice < 10000 && listing.price > maxPrice) return false;
  if (pets === "1" && !listing.pets_allowed) return false;
  if (smoking === "1" && !listing.smoking_allowed) return false;
  if (gender && listing.gender_preference !== gender) return false;
  if (rooms && (listing.rooms == null || listing.rooms < Number(rooms))) return false;
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

  const now = new Date().toISOString();
  await Promise.all(
    matches.map(async (s) => {
      await Promise.all([
        supabase!.from("notifications").insert({
          user_id: s.user_id,
          type: "new_matching_listing",
          title: "Nieuwe woning gevonden!",
          body: `Een nieuwe woning matcht met je opgeslagen zoekopdracht "${s.name}".`,
          related_id: listing.id,
        }),
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
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

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
      const { data, error: err } = await supabase
        .from("listings")
        .insert({
          title, description, price, location, type, availability_date, images, user_id: user.id,
          pets_allowed: petsAllowed, smoking_allowed: smokingAllowed, gender_preference, rooms, surface_area,
        })
        .select("id")
        .single();
      if (err || !data) {
        setError("Advertentie kon niet worden geplaatst. Probeer opnieuw.");
        return;
      }
      const listingId = (data as { id: string }).id;
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
          <div>
            <label htmlFor="nl-title" className={labelClass}>Titel *</label>
            <input id="nl-title" name="title" type="text" required maxLength={72} placeholder="Bijv. Ruime kamer in Amsterdam-Oost, 14m²" className={inputClass} data-testid="new-listing-title" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nl-type" className={labelClass}>Type</label>
              <select id="nl-type" name="type" className={selectClass} data-testid="new-listing-type">
                {TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
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
