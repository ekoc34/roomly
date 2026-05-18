import { useState, useEffect, useTransition, useRef } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/plausible";
import { LISTING_TYPE_LABELS, CITY_DISTRICTS } from "@/lib/constants";
import { ListingImageUpload } from "@/components/listings/ListingImageUpload";
import { ListingCard } from "@/components/listings/ListingCard";
import { isFullyVerified } from "@/lib/verificationUtils";
import { mapRpcError } from "@/lib/rpcErrors";
import type { ListingType, Profile, Listing } from "@/types/database";
import { checkListingSpam, getSpamMessageNL } from "@/lib/spamGuard";

const BANNER_DISMISSED_KEY = "roomly_verify_banner_dismissed";
const NEW_LISTING_IMAGES_KEY = "roomly_new_listing_images";

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


export function NewListingPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem(NEW_LISTING_IMAGES_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewListing, setPreviewListing] = useState<Listing | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
      if (p && p.role !== "admin" && (!p.subscription_tier || p.subscription_tier === "free")) {
        const { count } = await supabase!
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        setActiveListingCount(count ?? 0);
      }
    });
  }, [user]);

  // Persist uploaded images to sessionStorage so tab switches don't lose them
  useEffect(() => {
    try {
      if (images.length > 0) {
        sessionStorage.setItem(NEW_LISTING_IMAGES_KEY, JSON.stringify(images));
      } else {
        sessionStorage.removeItem(NEW_LISTING_IMAGES_KEY);
      }
    } catch {}
  }, [images]);

  const dismissBanner = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    setBannerDismissed(true);
  };

  const showVerifyBanner = !bannerDismissed && !!user && !isFullyVerified(user, profile);
  const emailVerified = !!(profile as unknown as { email_auto_verified?: boolean } | null)?.email_auto_verified;
  const phoneVerified = !!(profile as unknown as { phone_verified?: boolean } | null)?.phone_verified;

  const availableDistricts = city ? (CITY_DISTRICTS[city.toLowerCase()] ?? []) : [];

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCity(e.target.value);
    setDistrict("");
  };

  const handlePreview = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const previewTitle = String(fd.get("title") ?? "").trim() || "Jouw advertentie";
    const previewPrice = Number(fd.get("price") ?? 0);
    const previewDesc = String(fd.get("description") ?? "").trim();
    const previewType = String(fd.get("type") ?? "room_for_rent") as ListingType;
    const previewLocation = city
      ? district ? `${city}, ${district}` : city
      : String(fd.get("location_fallback") ?? "").trim() || "Jouw stad";
    const previewRoomsRaw = String(fd.get("rooms") ?? "").trim();
    const previewRooms = previewRoomsRaw !== "" ? Number(previewRoomsRaw) : null;
    const previewSurfaceRaw = String(fd.get("surface_area") ?? "").trim();
    const previewSurface = previewSurfaceRaw !== "" ? Number(previewSurfaceRaw) : null;
    const previewAvailRaw = String(fd.get("availability_date") ?? "").trim();

    setPreviewListing({
      id: "preview",
      title: previewTitle,
      description: previewDesc,
      price: previewPrice,
      location: previewLocation,
      type: previewType,
      images,
      pets_allowed: petsAllowed,
      smoking_allowed: smokingAllowed,
      gender_preference: null,
      rooms: previewRooms,
      surface_area: previewSurface,
      boosted_at: boosted ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      user_id: user?.id ?? "",
      availability_date: previewAvailRaw || null,
    } as unknown as Listing);
    setShowPreview(true);
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
  void activeListingCount;

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

    // ── Client-side spam detection (sync, uses static import) ─────────────
    const spamResult = checkListingSpam(title, description);
    if (spamResult.isSpam && (spamResult.severity === "high" || spamResult.severity === "medium")) {
      setError(getSpamMessageNL(spamResult.category, "listing"));
      return;
    }

    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }

      // ── Server-side rate limit + duplicate check ────────────────────────
      const { data: checkResult } = await supabase.rpc("check_listing_allowed", {
        p_title: title,
        p_location: location,
      });
      if (checkResult && !(checkResult as { allowed: boolean }).allowed) {
        const reason = (checkResult as { reason: string | null }).reason;
        if (reason === "LISTING_RATE_LIMIT") {
          setError("Je kunt maximaal 5 advertenties per dag plaatsen. Probeer het morgen opnieuw.");
        } else if (reason === "DUPLICATE_LISTING") {
          setError("Er staat al een vergelijkbare advertentie van jou online. Wacht 7 dagen voor je dezelfde advertentie opnieuw plaatst.");
        } else {
          setError("Advertentie kon niet worden geplaatst. Probeer opnieuw.");
        }
        return;
      }

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

      trackEvent("listing_created");

      sessionStorage.removeItem(NEW_LISTING_IMAGES_KEY);
      toast.success("Advertentie geplaatst!");

      // Fire-and-forget: match saved searches (server-side, never touches other inboxes directly).
      void supabase?.rpc("notify_saved_search_matches", { p_listing_id: listingId });

      // Fire-and-forget: geocode the listing server-side so MapPage can
      // place a marker without ever calling Nominatim from the browser.
      void supabase?.functions.invoke("geocode-listing", {
        body: { listing_id: listingId },
      });

      navigate(`/kamers/${listingId}`);
    });
  };

  return (
    <>
      {/* ── Preview Modal ── */}
      {showPreview && previewListing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-stone-50 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-stone-500">Voorbeeldweergave</p>
            <ListingCard listing={previewListing} currentUserId={user?.id} />
            <p className="mt-3 text-center text-xs text-stone-400">Zo ziet jouw advertentie eruit voor huurders</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <nav className="mb-6 text-sm text-stone-500">
          <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
          <span className="mx-2">›</span>
          <span className="text-stone-700">Advertentie plaatsen</span>
        </nav>
        <h1 className="text-2xl font-bold text-stone-900">Advertentie plaatsen</h1>
        <p className="mt-1 text-sm text-stone-500">Gratis — bereik duizenden huurders in heel Nederland.</p>
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-8" data-testid="new-listing-form">

            {/* Verification nudge — quiet inline */}
            {showVerifyBanner && (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-start gap-2 text-xs text-stone-600">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    Geverifieerde verhuurders ontvangen meer reacties.{" "}
                    <Link href="/profiel" className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
                      Verifieer je account →
                    </Link>
                  </span>
                </div>
                <button type="button" onClick={dismissBanner} aria-label="Sluiten"
                  className="shrink-0 text-stone-300 transition hover:text-stone-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ── Sectie 1: Basis ── */}
            <section className="space-y-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Basis</p>
              <div>
                <label htmlFor="nl-title" className={labelClass}>Titel *</label>
                <input id="nl-title" name="title" type="text" required maxLength={72}
                  placeholder="Bijv. Ruime kamer in Amsterdam-Oost, 14m²"
                  className={inputClass} data-testid="new-listing-title" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nl-type" className={labelClass}>Type</label>
                  <select id="nl-type" name="type" className={selectClass} data-testid="new-listing-type">
                    {getAvailableTypes(profile?.user_type).map((t) => (
                      <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="nl-price" className={labelClass}>Huurprijs per maand (€) *</label>
                  <input id="nl-price" name="price" type="number" required min={1} step={1}
                    placeholder="800" className={inputClass} data-testid="new-listing-price" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nl-city" className={labelClass}>Stad *</label>
                  <select id="nl-city" value={city} onChange={handleCityChange} className={selectClass} data-testid="new-listing-city">
                    <option value="">Kies een stad…</option>
                    {DUTCH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="nl-district" className={labelClass}>Stadsdeel / wijk</label>
                  <select id="nl-district" value={district} onChange={(e) => setDistrict(e.target.value)}
                    disabled={availableDistricts.length === 0}
                    className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
                    data-testid="new-listing-district"
                  >
                    <option value="">{availableDistricts.length === 0 ? "Kies eerst een stad" : "Heel de stad"}</option>
                    {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <hr className="border-stone-100" />

            {/* ── Sectie 2: Foto's ── */}
            <section className="space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Foto's</p>
                <p className="mt-1 text-xs text-stone-500">Voeg minimaal 2–3 foto's toe — advertenties met foto's krijgen beduidend meer reacties.</p>
              </div>
              <ListingImageUpload value={images} onChange={setImages} />
            </section>

            <hr className="border-stone-100" />

            {/* ── Sectie 3: Beschrijving ── */}
            <section className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Beschrijving</p>
              <textarea
                id="nl-desc"
                name="description"
                required
                rows={6}
                maxLength={4000}
                placeholder={"Vertel iets over:\n• de woning\n• de buurt\n• voorzieningen\n• wie je zoekt"}
                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                data-testid="new-listing-description"
              />
            </section>

            <hr className="border-stone-100" />

            {/* ── Sectie 4: Details (optioneel) ── */}
            <section className="space-y-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                Details <span className="normal-case font-normal text-stone-300 tracking-normal">(optioneel)</span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nl-avail" className={labelClass}>Beschikbaar per</label>
                  <input id="nl-avail" name="availability_date" type="date" className={inputClass} data-testid="new-listing-avail" />
                </div>
                <div>
                  <label htmlFor="nl-rooms" className={labelClass}>Aantal kamers</label>
                  <input id="nl-rooms" name="rooms" type="number" min={0} step={1} placeholder="bijv. 3" className={inputClass} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nl-surface" className={labelClass}>Woonoppervlakte</label>
                  <div className="relative mt-1.5">
                    <input id="nl-surface" name="surface_area" type="number" min={0} step={1} placeholder="bijv. 20"
                      className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-4 pr-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-stone-400">m²</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="nl-gender" className={labelClass}>Gendervoorkeur</label>
                  <select id="nl-gender" name="gender_preference" className={selectClass}>
                    <option value="">Geen voorkeur</option>
                    <option value="man">Alleen mannen</option>
                    <option value="vrouw">Alleen vrouwen</option>
                    <option value="gemengd">Gemengd</option>
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Huisregels</p>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm text-stone-700">Huisdieren toegestaan</span>
                  <button type="button" role="switch" aria-checked={petsAllowed} onClick={() => setPetsAllowed((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1 ${petsAllowed ? "bg-rose-500" : "bg-stone-300"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${petsAllowed ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </label>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm text-stone-700">Roken toegestaan</span>
                  <button type="button" role="switch" aria-checked={smokingAllowed} onClick={() => setSmokingAllowed((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-1 ${smokingAllowed ? "bg-rose-500" : "bg-stone-300"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${smokingAllowed ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </label>
              </div>
            </section>

            {/* Uitlichten — optional, secondary */}
            {(profile?.user_type === "verhuurder" || profile?.user_type === "huisgenoot_zoeker") && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-700">
                    Uitlichten <span className="text-xs font-normal text-stone-400">(optioneel)</span>
                  </p>
                  <p className="text-xs text-stone-400">Verschijn bovenaan in zoekresultaten. Gebruikt één boost credit.</p>
                </div>
                <button type="button" role="switch" aria-checked={boosted} onClick={() => setBoosted((v) => !v)}
                  className={`relative ml-4 inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 ${boosted ? "bg-amber-400" : "bg-stone-300"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${boosted ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>
            )}

            {/* Submit */}
            <div className="space-y-3">
              <button type="submit" disabled={isPending} data-testid="new-listing-submit"
                className="w-full rounded-xl bg-rose-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.99]"
              >
                {isPending ? "Bezig…" : "Advertentie plaatsen"}
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={handlePreview}
                  className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 active:scale-[0.99]"
                >
                  Bekijk voorbeeld
                </button>
                <Link href="/dashboard"
                  className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-center text-sm font-medium text-stone-500 transition hover:bg-stone-50"
                >
                  Annuleren
                </Link>
              </div>
              <p className="text-center text-xs text-stone-400">Gratis plaatsen · Geen abonnement nodig</p>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
