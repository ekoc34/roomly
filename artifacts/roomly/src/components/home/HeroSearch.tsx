import { Link } from "wouter";
import { CitySearchAutocomplete } from "@/components/search/CitySearchAutocomplete";
import { useSelectedCity } from "@/contexts/SelectedCityContext";

export function HeroSearch() {
  const { selectedCity } = useSelectedCity();

  return (
    <section data-testid="hero-search" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 px-6 py-14 shadow-sm ring-1 ring-stone-200/60 sm:px-10 sm:py-20">
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
          Voor iedereen in Nederland
        </p>

        {/* Dynamic title */}
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          {selectedCity ? (
            <>
              Alle woningen in{" "}
              <span className="text-rose-500">{selectedCity}</span>
            </>
          ) : (
            <>
              Vind je volgende thuis{" "}
              <span className="text-rose-500">zonder gedoe</span>
            </>
          )}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-stone-600 sm:text-lg">
          {selectedCity
            ? `Bekijk alle beschikbare kamers en appartementen in ${selectedCity}.`
            : "Kamers, appartementen en mede-huurders in heel Nederland. Zoek, reageer en chat direct met de verhuurder. Gratis — altijd."}
        </p>

        {/* Autocomplete search bar */}
        <CitySearchAutocomplete />

        <div className="mt-5">
          <Link
            href="/kamers"
            data-testid="hero-view-all-link"
            className="text-sm font-medium text-rose-600 underline-offset-4 hover:underline"
          >
            Bekijk alle woningen →
          </Link>
        </div>

        {/* Quick filters */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/kamers?type=room_for_rent"
            data-testid="quick-filter-room"
            className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Kamers
          </Link>
          <Link
            href="/kamers?type=short_stay"
            data-testid="quick-filter-short-stay"
            className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Kort verblijf
          </Link>
          <Link
            href="/kamers?max=800"
            data-testid="quick-filter-budget"
            className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tot €800
          </Link>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Geverifieerde gebruikers
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            In-app chat
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 shadow-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Geen spam
          </span>
        </div>
      </div>
    </section>
  );
}
