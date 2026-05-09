import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Scale, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCompare } from "@/contexts/CompareContext";
import { LISTING_TYPE_LABELS } from "@/lib/constants";
import type { Listing } from "@/types/database";

function yesNo(val: boolean | null | undefined): string {
  if (val === true) return "Ja";
  if (val === false) return "Nee";
  return "—";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Direct beschikbaar";
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

type Row = { label: string; key: (l: Listing) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Prijs per maand",       key: (l) => `€${Number(l.price).toFixed(0)}` },
  { label: "Locatie",               key: (l) => l.location },
  { label: "Type woning",           key: (l) => LISTING_TYPE_LABELS[l.type] ?? l.type },
  { label: "Aantal kamers",         key: (l) => l.rooms != null ? `${l.rooms} kamer${l.rooms !== 1 ? "s" : ""}` : "—" },
  { label: "Woonoppervlakte",       key: (l) => l.surface_area != null ? `${l.surface_area} m²` : "—" },
  { label: "Huisdieren toegestaan", key: (l) => yesNo(l.pets_allowed) },
  { label: "Roken toegestaan",      key: (l) => yesNo(l.smoking_allowed) },
  { label: "Gender voorkeur",       key: (l) => l.gender_preference ?? "—" },
  { label: "Beschikbaar vanaf",     key: (l) => formatDate(l.availability_date) },
];

export function ComparePage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { remove } = useCompare();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = (new URLSearchParams(searchStr).get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    if (ids.length === 0) {
      toast.info("Geen woningen geselecteerd om te vergelijken.");
      navigate("/kamers");
      return;
    }
    if (!supabase) { setLoading(false); return; }
    supabase
      .from("listings")
      .select("*")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        // Preserve the order from the URL params
        const ordered = ids.map((id) => data.find((l) => l.id === id)).filter(Boolean) as Listing[];
        setListings(ordered);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

  const handleRemove = (id: string) => {
    remove(id);
    const remaining = ids.filter((x) => x !== id);
    if (remaining.length === 0) {
      navigate("/kamers");
    } else {
      navigate(`/vergelijk?ids=${remaining.join(",")}`);
    }
  };

  const placeholderCount = Math.max(0, 3 - ids.length);

  return (
    <>
      <Helmet>
        <title>Woningen vergelijken — Welkthuis.nl</title>
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Scale className="h-6 w-6 text-rose-500" />
          <h1 className="text-2xl font-bold text-stone-900">Woningen vergelijken</h1>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
          </div>
        ) : (
          <>
            {/* ── DESKTOP: horizontal table ── */}
            <div className="hidden md:block">
              <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <thead>
                  <tr>
                    <th className="w-36 border-b border-r border-stone-100 bg-stone-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-400" />
                    {listings.map((l) => (
                      <th key={l.id} className="border-b border-r border-stone-100 bg-white px-4 py-3 last:border-r-0">
                        <div className="flex flex-col gap-2">
                          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
                            {l.images[0] ? (
                              <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-stone-300">
                                <Scale className="h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <Link
                            href={`/kamers/${l.id}`}
                            className="line-clamp-2 text-sm font-semibold text-stone-800 hover:text-rose-600 text-left"
                          >
                            {l.title}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleRemove(l.id)}
                            className="flex items-center gap-1 self-start rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:border-rose-200 hover:text-rose-600 transition"
                          >
                            <X className="h-3 w-3" />
                            Verwijder
                          </button>
                        </div>
                      </th>
                    ))}
                    {Array.from({ length: placeholderCount }).map((_, i) => (
                      <th key={`ph-${i}`} className="border-b border-r border-stone-100 px-4 py-3 last:border-r-0">
                        <Link
                          href="/kamers"
                          className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 p-6 text-stone-400 hover:border-rose-300 hover:text-rose-500 transition"
                        >
                          <Plus className="h-6 w-6" />
                          <span className="text-xs font-medium">Voeg woning toe</span>
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, ri) => (
                    <tr key={row.label} className={ri % 2 === 0 ? "bg-white" : "bg-stone-50/60"}>
                      <td className="border-r border-stone-100 px-4 py-3 text-xs font-semibold text-stone-500">
                        {row.label}
                      </td>
                      {listings.map((l) => (
                        <td key={l.id} className="border-r border-stone-100 px-4 py-3 text-sm text-stone-700 last:border-r-0">
                          {row.key(l)}
                        </td>
                      ))}
                      {Array.from({ length: placeholderCount }).map((_, i) => (
                        <td key={`ph-${i}`} className="border-r border-stone-100 px-4 py-3 last:border-r-0 text-sm text-stone-300">—</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── MOBILE: vertical card stack ── */}
            <div className="flex flex-col gap-4 md:hidden">
              {listings.map((l) => (
                <div key={l.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <div className="aspect-[16/9] bg-stone-100">
                    {l.images[0] ? (
                      <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-300">
                        <Scale className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/kamers/${l.id}`} className="font-semibold text-stone-800 hover:text-rose-600">
                        {l.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemove(l.id)}
                        className="shrink-0 flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-500 hover:border-rose-200 hover:text-rose-600 transition"
                      >
                        <X className="h-3 w-3" />
                        Verwijder
                      </button>
                    </div>
                    <dl className="mt-4 divide-y divide-stone-100">
                      {ROWS.map((row) => (
                        <div key={row.label} className="flex justify-between gap-4 py-2.5 text-sm">
                          <dt className="font-medium text-stone-500">{row.label}</dt>
                          <dd className="text-right text-stone-700">{row.key(l)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              ))}
              {placeholderCount > 0 && (
                <Link
                  href="/kamers"
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 p-8 text-stone-400 hover:border-rose-300 hover:text-rose-500 transition"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-sm font-medium">Voeg woning toe</span>
                </Link>
              )}
            </div>

            <div className="mt-6">
              <Link
                href="/kamers"
                className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-rose-600 transition"
              >
                ← Terug naar woningen
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
