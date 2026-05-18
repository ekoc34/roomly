import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useSelectedCity } from "@/contexts/SelectedCityContext";
import { useLanguage } from "@/contexts/LanguageContext";

function extractCity(location: string): string {
  // "Amsterdam, Jordaan" → "Amsterdam"; "Rotterdam" → "Rotterdam"
  return location.split(",")[0].trim();
}

export function CitySearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { setSelectedCity } = useSelectedCity();
  const { t } = useLanguage();

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from("listings")
          .select("location")
          .ilike("location", `%${query.trim()}%`)
          .limit(50);
        // Extract unique city names
        const cities = Array.from(
          new Set((data ?? []).map((r: { location: string }) => extractCity(r.location)))
        ).filter(Boolean).sort() as string[];
        setSuggestions(cities);
        setOpen(cities.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectCity = (city: string) => {
    setQuery(city);
    setSelectedCity(city);
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/kamers?q=${encodeURIComponent(city)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectCity(suggestions[activeIndex]);
    } else {
      setSelectedCity(trimmed);
      setOpen(false);
      navigate(`/kamers?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto max-w-xl" ref={containerRef}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
        <label className="sr-only" htmlFor="city-autocomplete">{t("home.citySearchLabel")}</label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <input
            id="city-autocomplete"
            ref={inputRef}
            data-testid="city-autocomplete-input"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            placeholder={t("home.searchPlaceholder")}
            className="h-[3.25rem] w-full rounded-2xl border border-stone-200 bg-white py-3.5 pl-11 pr-4 text-sm text-stone-900 shadow-[0_2px_10px_rgba(0,0,0,0.06)] placeholder:text-stone-400/70 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200/60 sm:text-base"
          />
          {loading && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
              <svg className="h-4 w-4 animate-spin text-stone-300" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </span>
          )}
        </div>
        <button
          type="submit"
          data-testid="city-autocomplete-submit"
          className="h-[3.25rem] rounded-2xl bg-rose-500 px-6 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(244,63,94,0.25)] transition hover:bg-rose-600 active:scale-[0.98] sm:px-7 sm:text-base"
        >
          {t("home.searchCta")}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
          data-testid="city-autocomplete-dropdown"
        >
          {suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-stone-400">{t("home.noResults")}</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1.5">
              {suggestions.map((city, i) => (
                <li key={city}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={() => selectCity(city)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      i === activeIndex
                        ? "bg-rose-50 text-rose-700"
                        : "text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>
                      <span className="font-medium">{city}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
