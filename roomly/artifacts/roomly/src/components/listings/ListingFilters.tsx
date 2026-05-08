import { useCallback, useState, useTransition } from "react";
import { useLocation, useSearch } from "wouter";
import { AMSTERDAM_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
const PRICE_MAX = 2000;
const PRICE_STEP = 50;
const SORT_OPTIONS = [
  { value: "newest", label: "Nieuwste eerst" },
  { value: "cheapest", label: "Goedkoopste eerst" },
] as const;

const GENDER_OPTIONS = [
  { value: "", label: "Geen voorkeur" },
  { value: "vrouw", label: "Vrouw" },
  { value: "man", label: "Man" },
  { value: "gemengd", label: "Gemengd" },
];

export function ListingFilters() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const [pending, startTransition] = useTransition();

  const searchParams = new URLSearchParams(searchString);

  const spMin = Number(searchParams.get("min") ?? 0);
  const spMax = Number(searchParams.get("max") ?? PRICE_MAX);
  const [sliderMin, setSliderMin] = useState(spMin);
  const [sliderMax, setSliderMax] = useState(spMax);

  const district = searchParams.get("district") ?? "";
  const type = searchParams.get("type") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const pets = searchParams.get("pets") ?? "";
  const smoking = searchParams.get("smoking") ?? "";
  const gender = searchParams.get("gender") ?? "";
  const minRooms = searchParams.get("min_rooms") ?? "";
  const minSurface = searchParams.get("min_surface") ?? "";

  const hasAdvanced = !!(pets || smoking || gender || minRooms || minSurface);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvanced);

  const activeCount = [
    searchParams.get("min"),
    searchParams.get("max"),
    district,
    type,
    searchParams.get("q"),
    pets,
    smoking,
    gender,
    minRooms,
    minSurface,
  ].filter(Boolean).length;

  const push = useCallback((updates: Record<string, string>) => {
    const next = new URLSearchParams(searchString);
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => navigate(`/kamers?${next.toString()}`));
  }, [navigate, searchString]);

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

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
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
          <label className="text-xs font-medium text-stone-700">Stadsdeel</label>
          <select
            value={district}
            onChange={(e) => push({ district: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <option value="">Alle stadsdelen</option>
            {AMSTERDAM_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

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

      <div className="mt-3 flex items-center gap-3">
        <label className="text-xs font-medium text-stone-700">Sorteren:</label>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="mt-4 border-t border-stone-100 pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-semibold text-stone-700 hover:text-rose-600"
        >
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Geavanceerd zoeken
            {hasAdvanced && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-600">
                {[pets, smoking, gender, minRooms, minSurface].filter(Boolean).length}
              </span>
            )}
          </span>
          <svg
            className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            <div>
              <label className="text-xs font-medium text-stone-700">Min. aantal kamers</label>
              <input
                type="number"
                min={1}
                max={20}
                value={minRooms}
                onChange={(e) => push({ min_rooms: e.target.value })}
                placeholder="Bijv. 2"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-stone-700">Min. oppervlakte (m²)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={minSurface}
                onChange={(e) => push({ min_surface: e.target.value })}
                placeholder="Bijv. 12"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-700 select-none">
                <input
                  type="checkbox"
                  checked={pets === "1"}
                  onChange={(e) => push({ pets: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="flex items-center gap-1.5">
                  <span>🐾</span>
                  Huisdieren toegestaan
                </span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-stone-700 select-none">
                <input
                  type="checkbox"
                  checked={smoking === "1"}
                  onChange={(e) => push({ smoking: e.target.checked ? "1" : "" })}
                  className="h-4 w-4 rounded accent-rose-500"
                />
                <span className="flex items-center gap-1.5">
                  <span>🚬</span>
                  Roken toegestaan
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
