import { useCallback, useState, useTransition } from "react";
import { useLocation, useSearch } from "wouter";
import { AMSTERDAM_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
const PRICE_MAX = 2000;
const SORT_OPTIONS = [
  { value: "newest", label: "Nieuwste eerst" },
  { value: "cheapest", label: "Goedkoopste eerst" },
] as const;

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

  const activeCount = [
    searchParams.get("min"),
    searchParams.get("max"),
    district,
    type,
    searchParams.get("q"),
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
    </div>
  );
}

const PRICE_STEP = 50;
