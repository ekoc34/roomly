"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { AMSTERDAM_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];
const PRICE_MAX = 2000;
const PRICE_STEP = 50;
const SORT_OPTIONS = [
  { value: "newest", label: "Nieuwste eerst" },
  { value: "cheapest", label: "Goedkoopste eerst" },
] as const;

export function ListingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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

  const push = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      startTransition(() => router.push(`/kamers?${next.toString()}`));
    },
    [router, searchParams],
  );

  const commitPrice = () =>
    push({
      min: sliderMin > 0 ? String(sliderMin) : "",
      max: sliderMax < PRICE_MAX ? String(sliderMax) : "",
    });

  const clearFilters = () => {
    setSliderMin(0);
    setSliderMax(PRICE_MAX);
    const next = new URLSearchParams();
    const s = searchParams.get("sort");
    if (s && s !== "newest") next.set("sort", s);
    startTransition(() => router.push(`/kamers?${next.toString()}`));
  };

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-900">Filters</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pending && (
            <span className="text-xs text-stone-400">Bijwerken…</span>
          )}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-rose-600 hover:underline"
            >
              Wis filters
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_2fr_1.2fr]">
        {/* Price range sliders */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600">Prijs / maand</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-700">
              €{sliderMin} – {sliderMax >= PRICE_MAX ? "2000+" : `€${sliderMax}`}
            </span>
          </div>
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-right text-xs text-stone-400">Min</span>
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={sliderMin}
                onChange={(e) => setSliderMin(Number(e.target.value))}
                onMouseUp={commitPrice}
                onTouchEnd={commitPrice}
                className="h-1.5 w-full cursor-pointer accent-rose-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-right text-xs text-stone-400">Max</span>
              <input
                type="range"
                min={0}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={sliderMax}
                onChange={(e) => setSliderMax(Number(e.target.value))}
                onMouseUp={commitPrice}
                onTouchEnd={commitPrice}
                className="h-1.5 w-full cursor-pointer accent-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Location dropdown */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-600">Stadsdeel</span>
          <select
            value={district}
            onChange={(e) => push({ district: e.target.value })}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <option value="">Alle wijken</option>
            {AMSTERDAM_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Type pill toggles */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-600">Type advertentie</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => push({ type: "" })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                !type
                  ? "bg-rose-500 text-white shadow-sm"
                  : "border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              }`}
            >
              Alle
            </button>
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => push({ type: type === t ? "" : t })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  type === t
                    ? "bg-rose-500 text-white shadow-sm"
                    : "border border-stone-200 text-stone-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                {LISTING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Sort toggle */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-stone-600">Sorteren op</span>
          <div className="flex flex-col gap-1.5">
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    push({ sort: opt.value === "newest" ? "" : opt.value })
                  }
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                    active
                      ? "bg-stone-900 text-white"
                      : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {opt.label}
                  {active && (
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
