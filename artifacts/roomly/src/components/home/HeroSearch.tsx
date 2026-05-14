import { Link } from "wouter";
import { CitySearchAutocomplete } from "@/components/search/CitySearchAutocomplete";
import { useSelectedCity } from "@/contexts/SelectedCityContext";

const POPULAR_CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag"];

export function HeroSearch() {
  const { selectedCity } = useSelectedCity();

  return (
    <section data-testid="hero-search" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 px-6 py-14 shadow-sm ring-1 ring-stone-200/60 sm:px-10 sm:py-20">
      <div className="relative mx-auto max-w-2xl text-center">

        {/* Headline */}
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          {selectedCity ? (
            <>
              Woningen in{" "}
              <span className="text-rose-500">{selectedCity}</span>
            </>
          ) : (
            <>
              Vind je thuis{" "}
              <span className="text-rose-500">in Nederland</span>
            </>
          )}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-stone-500 sm:text-lg">
          {selectedCity
            ? `Beschikbare kamers en appartementen in ${selectedCity} — van echte verhuurders.`
            : "Kamers, studio's en appartementen van echte verhuurders. Geen spam, geen misleiding."}
        </p>

        {/* Search bar — central element */}
        <CitySearchAutocomplete />

        {/* Secondary CTA */}
        <p className="mt-3 text-sm text-stone-500">
          Wil je verhuren?{" "}
          <Link href="/kamers/nieuw" className="font-medium text-rose-600 underline-offset-4 hover:underline">
            Advertentie plaatsen →
          </Link>
        </p>

        {/* City chips — subtle */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {POPULAR_CITIES.map((city) => (
            <Link
              key={city}
              href={`/kamers?city=${encodeURIComponent(city)}`}
              className="rounded-full border border-stone-200 bg-white px-3.5 py-1 text-xs font-medium text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
            >
              {city}
            </Link>
          ))}
        </div>

        {/* Category chips — subtle */}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href="/kamers?type=room_for_rent" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-400 transition hover:border-rose-200 hover:text-rose-500">Kamers</Link>
          <Link href="/kamers?q=appartement" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-400 transition hover:border-rose-200 hover:text-rose-500">Appartementen</Link>
          <Link href="/kamers?q=studio" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-400 transition hover:border-rose-200 hover:text-rose-500">Studio's</Link>
          <Link href="/kamers?type=short_stay" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-400 transition hover:border-rose-200 hover:text-rose-500">Kort verblijf</Link>
          <Link href="/kamers?max=800" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-400 transition hover:border-rose-200 hover:text-rose-500">Tot €800</Link>
        </div>

        {/* Trust badges — minimal */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Geverifieerde gebruikers
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            In-app chat
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Geen spam
          </span>
        </div>

      </div>
    </section>
  );
}
