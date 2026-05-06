import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { useSelectedCity } from "@/contexts/SelectedCityContext";

function extractNeighborhood(location: string, city: string): string | null {
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 2 && parts[0].toLowerCase() === city.toLowerCase()) {
    return parts.slice(1).join(", ");
  }
  return null;
}

const NEIGHBORHOOD_COLORS = [
  "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
  "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
  "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
  "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
  "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100",
  "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
];

export function NeighborhoodSection() {
  const { selectedCity } = useSelectedCity();
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCity || !supabase) {
      setNeighborhoods([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setNeighborhoods([]);
    setLoading(true);

    supabase
      .from("listings")
      .select("location")
      .ilike("location", `${selectedCity},%`)
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoading(false);
          return;
        }
        const hoods = Array.from(
          new Set(
            (data ?? [])
              .map((r: { location: string }) =>
                extractNeighborhood(r.location, selectedCity)
              )
              .filter((h): h is string => !!h && h.length > 0)
          )
        ).sort();
        setNeighborhoods(hoods);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCity]);

  if (!selectedCity) return null;

  return (
    <section className="mt-12" data-testid="neighborhood-section">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">
            Stadsdelen in{" "}
            <span className="text-rose-500">{selectedCity}</span>
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">Zoek op wijk of buurt</p>
        </div>
        <Link
          href={`/kamers?q=${encodeURIComponent(selectedCity)}`}
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Alle woningen in {selectedCity} →
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="h-9 w-24 animate-pulse rounded-full bg-stone-200"
            />
          ))}
        </div>
      ) : neighborhoods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm text-stone-500">
            Geen stadsdelen gevonden in <strong>{selectedCity}</strong>.{" "}
            <Link
              href={`/kamers?q=${encodeURIComponent(selectedCity)}`}
              className="text-rose-600 hover:underline"
            >
              Bekijk alle woningen
            </Link>{" "}
            in deze stad.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {neighborhoods.map((hood, i) => (
            <Link
              key={hood}
              href={`/kamers?q=${encodeURIComponent(hood)}`}
              data-testid={`neighborhood-${hood}`}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition hover:scale-105 active:scale-95 ${
                NEIGHBORHOOD_COLORS[i % NEIGHBORHOOD_COLORS.length]
              }`}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {hood}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
