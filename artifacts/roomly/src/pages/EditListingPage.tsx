import { useEffect, useState, useTransition } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LISTING_TYPE_LABELS, CITY_DISTRICTS } from "@/lib/constants";
import { ListingImageUpload } from "@/components/listings/ListingImageUpload";
import type { Listing, ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

const DUTCH_CITIES = [
  "Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven",
  "Groningen", "Maastricht", "Leiden", "Delft", "Tilburg",
  "Breda", "Nijmegen", "Arnhem", "Haarlem", "'s-Hertogenbosch",
];

const inputClass = "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
const selectClass = "mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
const labelClass = "text-xs font-medium text-stone-700";

function parseLocation(location: string): { city: string; district: string } {
  const idx = location.indexOf(", ");
  if (idx !== -1) return { city: location.slice(0, idx), district: location.slice(idx + 2) };
  return { city: location, district: "" };
}

export function EditListingPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

  const availableDistricts = city ? (CITY_DISTRICTS[city.toLowerCase()] ?? []) : [];

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value);
    setDistrict("");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!supabase) { setLoading(false); return; }
    async function fetchListing() {
      const { data } = await supabase!.from("listings").select("*").eq("id", params.id).maybeSingle();
      if (!data) { setNotFound(true); setLoading(false); return; }
      const l = data as Listing;
      setListing(l);
      setImages(l.images ?? []);
      setPetsAllowed(l.pets_allowed ?? false);
      setSmokingAllowed(l.smoking_allowed ?? false);
      const parsed = parseLocation(l.location ?? "");
      setCity(parsed.city);
      setDistrict(parsed.district);
      setLoading(false);
    }
    fetchListing();
  }, [params.id, authLoading]);

  const onDelete = () => {
    if (!confirm("Weet je zeker dat je deze advertentie wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    startTransition(async () => {
      if (!supabase || !user) return;
      await supabase.from("listings").delete().eq("id", params.id).eq("user_id", user.id);
      toast.success("Advertentie verwijderd.");
      navigate("/dashboard");
    });
  };

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
    if (!title || !description || !location || price <= 0) { setError("Vul alle verplichte velden in."); return; }
    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }
      const { error: err } = await supabase
        .from("listings")
        .update({
          title, description, price, location, type, availability_date, images,
          pets_allowed: petsAllowed, smoking_allowed: smokingAllowed, gender_preference, rooms, surface_area,
        })
        .eq("id", params.id)
        .eq("user_id", user.id);
      if (err) { setError("Opslaan mislukt."); return; }
      toast.success("Wijzigingen opgeslagen!");
      navigate(`/kamers/${params.id}`);
    });
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je advertentie te bewerken</h1>
        <Link href="/inloggen" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-6xl font-black text-stone-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-stone-900">Advertentie niet gevonden</h1>
        <Link href="/dashboard" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Terug naar dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Advertentie bewerken</span>
      </nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Advertentie bewerken</h1>
        <button type="button" onClick={onDelete} disabled={isPending} className="text-xs font-medium text-red-500 hover:underline" data-testid="delete-listing-button">Verwijderen</button>
      </div>
      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-stone-200" />)}
          </div>
        ) : listing && (
          <form onSubmit={onSubmit} className="space-y-5" data-testid="edit-listing-form">
            <div>
              <label htmlFor="el-title" className={labelClass}>Titel *</label>
              <input id="el-title" name="title" type="text" required maxLength={72} defaultValue={listing.title} className={inputClass} data-testid="edit-listing-title" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="el-type" className={labelClass}>Type</label>
                <select id="el-type" name="type" defaultValue={listing.type} className={selectClass}>
                  {TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="el-price" className={labelClass}>Prijs per maand (€) *</label>
                <input id="el-price" name="price" type="number" required min={1} step={1} defaultValue={listing.price} className={inputClass} data-testid="edit-listing-price" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="el-city" className={labelClass}>Stad *</label>
                <select
                  id="el-city"
                  value={city}
                  onChange={handleCityChange}
                  className={selectClass}
                  data-testid="edit-listing-city"
                >
                  <option value="">Kies een stad…</option>
                  {DUTCH_CITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="el-district" className={labelClass}>Stadsdeel / wijk</label>
                <select
                  id="el-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={availableDistricts.length === 0}
                  className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  data-testid="edit-listing-district"
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
                <label htmlFor="el-avail" className={labelClass}>Beschikbaar per</label>
                <input id="el-avail" name="availability_date" type="date" defaultValue={listing.availability_date ?? ""} className={inputClass} />
              </div>
              <div>
                <label htmlFor="el-gender" className={labelClass}>Gender voorkeur</label>
                <select id="el-gender" name="gender_preference" defaultValue={listing.gender_preference ?? ""} className={selectClass}>
                  <option value="">Geen voorkeur</option>
                  <option value="man">Alleen mannen</option>
                  <option value="vrouw">Alleen vrouwen</option>
                  <option value="gemengd">Gemengd</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="el-rooms" className={labelClass}>Aantal kamers</label>
                <input id="el-rooms" name="rooms" type="number" min={0} step={1} defaultValue={listing.rooms ?? ""} placeholder="bijv. 3" className={inputClass} />
              </div>
              <div>
                <label htmlFor="el-surface" className={labelClass}>Woonoppervlakte</label>
                <div className="relative mt-1.5">
                  <input id="el-surface" name="surface_area" type="number" min={0} step={1} defaultValue={listing.surface_area ?? ""} placeholder="bijv. 20" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-4 pr-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
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
              <label htmlFor="el-desc" className={labelClass}>Beschrijving *</label>
              <textarea id="el-desc" name="description" required rows={6} maxLength={4000} defaultValue={listing.description} className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </div>
            <ListingImageUpload value={images} onChange={setImages} />
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={isPending} data-testid="edit-listing-submit" className="flex-1 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
                {isPending ? "Bezig…" : "Wijzigingen opslaan"}
              </button>
              <Link href={`/kamers/${params.id}`} className="rounded-2xl border border-stone-200 px-5 py-3 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">Annuleren</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
