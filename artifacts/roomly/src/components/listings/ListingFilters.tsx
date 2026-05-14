import { useCallback, useState, useTransition } from "react";
import { useLocation, useSearch } from "wouter";
import { CITY_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

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

const SELECT_CLASS =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";

export function ListingFilters() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const [pending, startTransition] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const searchParams = new URLSearchParams(searchString);
  const currentQ = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(currentQ);

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
  const minPrice = searchParams.get("min") ?? "";
  const maxPrice = searchParams.get("max") ?? "";

  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);

  const availableDistricts = city ? (CITY_DISTRICTS[city.toLowerCase()] ?? []) : [];
  const advancedCount = [district, pets, smoking, gender, rooms, minSurface].filter(Boolean).length;

  const push = useCallback((updates: Record<string, string>) => {
    const next = new URLSearchParams(searchString);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => navigate(`/kamers?${next.toString()}`));
  }, [navigate, searchString]);

  const handleCityChange = (newCity: string) => push({ city: newCity, district: "" });

  const commitPrice = () => push({ min: localMin, max: localMax });

  const clearFilters = () => {
    setLocalMin("");
    setLocalMax("");
    const next = new URLSearchParams();
    const s = searchParams.get("sort");
    if (s && s !== "newest") next.set("sort", s);
    startTransition(() => navigate(`/kamers?${next.toString()}`));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    push({ q: searchInput.trim() });
  };

  // Active filter pills
  const activePills: { key: string; label: string; clear: Record<string, string> }[] = [];
  if (currentQ) activePills.push({ key: "q", label: `"${currentQ}"`, clear: { q: "" } });
  if (city) activePills.push({ key: "city", label: city, clear: { city: "", district: "" } });
  if (district) activePills.push({ key: "district", label: district, clear: { district: "" } });
  if (type) activePills.push({ key: "type", label: LISTING_TYPE_LABELS[type as ListingType] ?? type, clear: { type: "" } });
  if (minPrice) activePills.push({ key: "min", label: `Min €${minPrice}`, clear: { min: "" } });
  if (maxPrice) activePills.push({ key: "max", label: `Max €${maxPrice}`, clear: { max: "" } });
  if (pets === "1") activePills.push({ key: "pets", label: "Huisdieren", clear: { pets: "" } });
  if (smoking === "1") activePills.push({ key: "smoking", label: "Roken ok", clear: { smoking: "" } });
  if (gender) activePills.push({ key: "gender", label: GENDER_OPTIONS.find((g) => g.value === gender)?.label ?? gender, clear: { gender: "" } });
  if (rooms) activePills.push({ key: "rooms", label: `${rooms}+ kamers`, clear: { rooms: "" } });
  if (minSurface) activePills.push({ key: "min_surface", label: `${minSurface}m²+`, clear: { min_surface: "" } });
  if (verified === "1") activePills.push({ key: "verified", label: "Geverifieerd", clear: { verified: "" } });

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Zoek op titel, omschrijving of locatie…"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
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

      {/* Primary filters — Stad · Type · Prijs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-600">Stad</label>
          <select value={city} onChange={(e) => handleCityChange(e.target.value)} className={SELECT_CLASS}>
            <option value="">Alle steden</option>
            {DUTCH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-600">Type woning</label>
          <select value={type} onChange={(e) => push({ type: e.target.value })} className={SELECT_CLASS}>
            <option value="">Alle types</option>
            {TYPES.map((t) => <option key={t} value={t}>{LISTING_TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-stone-600">Prijs per maand</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={9999}
              step={50}
              value={localMin}
              onChange={(e) => setLocalMin(e.target.value)}
              onBlur={commitPrice}
              placeholder="Min"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <span className="shrink-0 text-xs text-stone-400">–</span>
            <input
              type="number"
              min={0}
              max={9999}
              step={50}
              value={localMax}
              onChange={(e) => setLocalMax(e.target.value)}
              onBlur={commitPrice}
              placeholder="Max"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>
        </div>
      </div>

      {/* Quick category chips */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[
          {
            label: "Kamers",
            active: type === "room_for_rent",
            onClick: () => push({ type: type === "room_for_rent" ? "" : "room_for_rent" }),
          },
          {
            label: "Appartementen",
            active: currentQ === "appartement",
            onClick: () => { const n = currentQ === "appartement" ? "" : "appartement"; setSearchInput(n); push({ q: n }); },
          },
          {
            label: "Studio's",
            active: currentQ === "studio",
            onClick: () => { const n = currentQ === "studio" ? "" : "studio"; setSearchInput(n); push({ q: n }); },
          },
          {
            label: "Huisgenoot gezocht",
            active: currentQ === "huisgenoot",
            onClick: () => { const n = currentQ === "huisgenoot" ? "" : "huisgenoot"; setSearchInput(n); push({ q: n }); },
          },
          {
            label: "Geverifieerd",
            active: verified === "1",
            onClick: () => push({ verified: verified === "1" ? "" : "1" }),
          },
        ].map(({ label, active, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-rose-500 text-white shadow-sm"
                : "border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort + clear row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => push({ sort: opt.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sort === opt.value
                  ? "bg-stone-800 text-white"
                  : "border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {activePills.length > 0 && (
          <button type="button" onClick={clearFilters} className="text-xs text-stone-400 hover:text-rose-600">
            Wis alles
          </button>
        )}
      </div>

      {/* Active filter pill strip */}
      {activePills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => push(pill.clear)}
              className="flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
            >
              {pill.label}
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Advanced filters (collapsed) */}
      <div className="mt-4 border-t border-stone-100 pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          <span className="flex items-center gap-1.5">
            Meer filters
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
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* District — secondary, lives here */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Stadsdeel</label>
              <select
                value={district}
                onChange={(e) => push({ district: e.target.value })}
                disabled={availableDistricts.length === 0}
                className={SELECT_CLASS + " disabled:cursor-not-allowed disabled:opacity-40"}
              >
                <option value="">{availableDistricts.length === 0 ? "Kies eerst een stad" : "Alle stadsdelen"}</option>
                {availableDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Min. kamers</label>
              <select value={rooms} onChange={(e) => push({ rooms: e.target.value })} className={SELECT_CLASS}>
                <option value="">Alle</option>
                {ROOMS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Min. oppervlakte (m²)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={minSurface}
                onChange={(e) => push({ min_surface: e.target.value })}
                placeholder="Bijv. 20"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-600">Gender voorkeur</label>
              <select value={gender} onChange={(e) => push({ gender: e.target.value })} className={SELECT_CLASS}>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={pets === "1"}
                  onChange={(e) => push({ pets: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="text-xs font-medium text-stone-600">Huisdieren toegestaan</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={smoking === "1"}
                  onChange={(e) => push({ smoking: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="text-xs font-medium text-stone-600">Roken toegestaan</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
