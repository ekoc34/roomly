import { useCallback, useState, useTransition } from "react";
import { useLocation, useSearch } from "wouter";
import { CITY_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
const PRICE_MAX = 2000;
const PRICE_STEP = 50;

const DUTCH_CITIES = [
  "Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven",
  "Groningen", "Maastricht", "Leiden", "Delft", "Tilburg",
  "Breda", "Nijmegen", "Arnhem", "Haarlem", "'s-Hertogenbosch",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Nieuwste eerst" },
  { value: "cheapest", label: "Goedkoopste eerst" },
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Geen voorkeur" },
  { value: "man", label: "Alleen mannen" },
  { value: "vrouw", label: "Alleen vrouwen" },
  { value: "gemengd", label: "Gemengd" },
];

const ROOMS_OPTIONS = [
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

export function ListingFilters() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const [pending, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const searchParams = new URLSearchParams(searchString);
  const currentQ = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(currentQ);

  const spMin = Number(searchParams.get("min") ?? 0);
  const spMax = Number(searchParams.get("max") ?? PRICE_MAX);
  const [sliderMin, setSliderMin] = useState(spMin);
  const [sliderMax, setSliderMax] = useState(spMax);

  const city = searchParams.get("city") ?? "";
  const district = searchParams.get("district") ?? "";
  const type = searchParams.get("type") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const pets = searchParams.get("pets") ?? "";
  const smoking = searchParams.get("smoking") ?? "";
  const gender = searchParams.get("gender") ?? "";
  const rooms = searchParams.get("rooms") ?? "";
  const minSurface = searchParams.get("min_surface") ?? "";
  const verified = searchParams.get("verified") ?? "";

  const availableDistricts = city ? (CITY_DISTRICTS[city.toLowerCase()] ?? []) : [];

  const advancedCount = [pets, smoking, gender, rooms, minSurface].filter(Boolean).length;

  const activeCount = [
    searchParams.get("min"),
    searchParams.get("max"),
    city,
    district,
    type,
    searchParams.get("q"),
    pets,
    smoking,
    gender,
    rooms,
    minSurface,
    verified,
  ].filter(Boolean).length;

  const push = useCallback((updates: Record<string, string>) => {
    const next = new URLSearchParams(searchString);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => navigate(`/kamers?${next.toString()}`));
  }, [navigate, searchString]);

  const handleCityChange = (newCity: string) => {
    push({ city: newCity, district: "" });
  };

  const commitPrice = () => push({
    min: sliderMin > 0 ? String(sliderMin) : "",
    max: sliderMax < PRICE_MAX ? String(sliderMax) : "",
  });

  const clearFilters = () => {
    setSliderMin(0);
    setSliderMax(PRICE_MAX);
    const next = new URLSearchParams();
    const s = searchParams.get("sort");
    if (s && s !== "newest") next.set("sort", s);
    startTransition(() => navigate(`/kamers?${next.toString()}`));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    push({ q: searchInput.trim() });
  };

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
      <form onSubmit={handleSearchSubmit} className="mb-4">
        <label className="text-xs font-medium text-stone-700">Zoeken in advertenties</label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Zoek op titel, omschrijving of locatie…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); push({ q: "" }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                aria-label="Zoekopdracht wissen"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
          >
            Zoeken
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-900">Filters</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button type="button" onClick={clearFilters} className="text-xs text-stone-500 hover:text-rose-600">
            Wis filters
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-stone-700">Min prijs</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={sliderMin}
              onChange={(e) => setSliderMin(Number(e.target.value))}
              onMouseUp={commitPrice}
              onTouchEnd={commitPrice}
              className="w-full accent-rose-500"
            />
            <span className="w-16 shrink-0 text-xs text-stone-600">€{sliderMin}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-stone-700">Max prijs</label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={sliderMax}
              onChange={(e) => setSliderMax(Number(e.target.value))}
              onMouseUp={commitPrice}
              onTouchEnd={commitPrice}
              className="w-full accent-rose-500"
            />
            <span className="w-16 shrink-0 text-xs text-stone-600">{sliderMax < PRICE_MAX ? `€${sliderMax}` : "Alles"}</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-stone-700">Stad</label>
          <select
            value={city}
            onChange={(e) => handleCityChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <option value="">Alle steden</option>
            {DUTCH_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-stone-700">Stadsdeel</label>
          <select
            value={district}
            onChange={(e) => push({ district: e.target.value })}
            disabled={availableDistricts.length === 0}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{availableDistricts.length === 0 ? "Kies eerst een stad" : "Alle stadsdelen"}</option>
            {availableDistricts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-xs font-medium text-stone-700">Type</label>
          <select
            value={type}
            onChange={(e) => push({ type: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <option value="">Alle types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium text-stone-700">Sorteren:</label>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => push({ sort: opt.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${sort === opt.value ? "bg-rose-500 text-white" : "border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"}`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => push({ verified: verified === "1" ? "" : "1" })}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${verified === "1" ? "bg-rose-500 text-white" : "border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"}`}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Geverifieerde verhuurders
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between text-xs font-semibold text-stone-700 hover:text-rose-600"
        >
          <span className="flex items-center gap-1.5">
            Geavanceerd zoeken
            {advancedCount > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {advancedCount}
              </span>
            )}
          </span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-stone-700">Minimaal aantal kamers</label>
              <select
                value={rooms}
                onChange={(e) => push({ rooms: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              >
                <option value="">Alle</option>
                {ROOMS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-stone-700">Min. oppervlakte (m²)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={minSurface}
                onChange={(e) => push({ min_surface: e.target.value })}
                placeholder="Bijv. 20"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-700">Gender voorkeur</label>
              <select
                value={gender}
                onChange={(e) => push({ gender: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={pets === "1"}
                  onChange={(e) => push({ pets: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="text-xs font-medium">Huisdieren toegestaan</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={smoking === "1"}
                  onChange={(e) => push({ smoking: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="text-xs font-medium">Roken toegestaan</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
