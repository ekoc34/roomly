import { useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import { ListingImageUpload } from "@/components/listings/ListingImageUpload";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

export function NewListingPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [basicOpen, setBasicOpen] = useState(true);
  const [locationOpen, setLocationOpen] = useState(true);
  const [description, setDescription] = useState("");

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
    const location = String(fd.get("location") ?? "").trim();
    const type = String(fd.get("type") ?? "room_for_rent") as ListingType;
    const availability_date = String(fd.get("availability_date") ?? "").trim() || null;

    if (!title || !description || !location || price <= 0) {
      setError("Vul alle verplichte velden in (titel, beschrijving, locatie, prijs).");
      return;
    }
    startTransition(async () => {
      if (!supabase || !user) { setError("Niet ingelogd."); return; }
      const { data, error: err } = await supabase
        .from("listings")
        .insert({ title, description, price, location, type, availability_date, images, user_id: user.id })
        .select("id")
        .single();
      if (err || !data) {
        setError("Advertentie kon niet worden geplaatst. Probeer opnieuw.");
        return;
      }
      toast.success("Advertentie geplaatst!");
      navigate(`/kamers/${data.id}`);
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 pb-24">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Advertentie plaatsen</span>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900">Advertentie plaatsen</h1>
      <p className="mt-1 text-sm text-stone-500">Gratis — bereik duizenden huurders in heel Nederland.</p>
      <div className="mt-6 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8">
        <form onSubmit={onSubmit} className="space-y-5" data-testid="new-listing-form">
          {/* Basisgegevens Section */}
          <div className="border-b border-stone-200 pb-4">
            <button
              type="button"
              onClick={() => setBasicOpen(!basicOpen)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-stone-900">Basisgegevens</span>
              <svg className={`h-4 w-4 text-stone-500 transition-transform ${basicOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {basicOpen && (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="nl-title" className="text-xs font-medium text-stone-700">Titel *</label>
                  <input id="nl-title" name="title" type="text" required maxLength={72} placeholder="Bijv. Ruime kamer in Amsterdam-Oost, 14m²" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-title" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nl-type" className="text-xs font-medium text-stone-700">Type</label>
                    <select id="nl-type" name="type" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-type">
                      {TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="nl-price" className="text-xs font-medium text-stone-700">Prijs per maand (€) *</label>
                    <input id="nl-price" name="price" type="number" required min={1} step={1} placeholder="800" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-price" />
                  </div>
                </div>
                <div>
                  <label htmlFor="nl-desc" className="text-xs font-medium text-stone-700">Beschrijving *</label>
                  <textarea 
                    id="nl-desc" 
                    name="description" 
                    required 
                    rows={6} 
                    maxLength={4000} 
                    placeholder="Omschrijf de woning, huurder, voorzieningen en buurt…" 
                    className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" 
                    data-testid="new-listing-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-stone-500">{description.length}/4000 tekens</p>
                </div>
              </div>
            )}
          </div>

          {/* Locatie & Type Section */}
          <div className="border-b border-stone-200 pb-4">
            <button
              type="button"
              onClick={() => setLocationOpen(!locationOpen)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-stone-900">Locatie & Beschikbaarheid</span>
              <svg className={`h-4 w-4 text-stone-500 transition-transform ${locationOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {locationOpen && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="nl-location" className="text-xs font-medium text-stone-700">Locatie *</label>
                  <input id="nl-location" name="location" type="text" required placeholder="Amsterdam, Jordaan" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-location" />
                </div>
                <div>
                  <label htmlFor="nl-avail" className="text-xs font-medium text-stone-700">Beschikbaar per</label>
                  <input id="nl-avail" name="availability_date" type="date" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" data-testid="new-listing-avail" />
                </div>
              </div>
            )}
          </div>

          {/* Images Section */}
          <div>
            <span className="text-sm font-semibold text-stone-900">Foto's</span>
            <div className="mt-4">
              <ListingImageUpload value={images} onChange={setImages} />
            </div>
          </div>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        </form>
      </div>
      
      {/* Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white/95 backdrop-blur-md p-4 md:hidden">
        <div className="mx-auto max-w-2xl">
          <div className="flex gap-3">
            <button 
              type="submit" 
              form="new-listing-form"
              disabled={isPending} 
              data-testid="new-listing-submit" 
              className="flex-1 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Bezig…" : "Advertentie plaatsen"}
            </button>
            <Link href="/dashboard" className="rounded-2xl border border-stone-200 px-5 py-3 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">Annuleren</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
