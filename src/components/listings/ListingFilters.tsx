"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { AMSTERDAM_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import type { ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

export function ListingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      startTransition(() => {
        router.push(`/kamers?${next.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-stone-900">Filters</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Min. prijs (€)
          <input
            type="number"
            min={0}
            defaultValue={searchParams.get("min") ?? ""}
            name="min"
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900"
            onChange={(e) => update("min", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Max. prijs (€)
          <input
            type="number"
            min={0}
            defaultValue={searchParams.get("max") ?? ""}
            name="max"
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900"
            onChange={(e) => update("max", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Stadsdeel / wijk
          <select
            defaultValue={searchParams.get("district") ?? ""}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900"
            onChange={(e) => update("district", e.target.value)}
          >
            <option value="">Alle</option>
            {AMSTERDAM_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
          Type
          <select
            defaultValue={searchParams.get("type") ?? ""}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900"
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="">Alle</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {LISTING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pending && (
        <p className="mt-3 text-xs text-stone-400">Resultaten bijwerken…</p>
      )}
    </div>
  );
}
