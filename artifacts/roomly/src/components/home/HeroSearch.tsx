import { Link } from "wouter";
import { CitySearchAutocomplete } from "@/components/search/CitySearchAutocomplete";
import { useSelectedCity } from "@/contexts/SelectedCityContext";
import { useLanguage } from "@/contexts/LanguageContext";

const POPULAR_CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Eindhoven", "Den Haag"];

export function HeroSearch() {
  const { selectedCity } = useSelectedCity();
  const { t } = useLanguage();

  return (
    <section data-testid="hero-search" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50/60 px-6 py-10 shadow-sm ring-1 ring-stone-200/60 sm:px-12 sm:py-14">
      <div className="relative mx-auto max-w-xl text-center">

        {/* Headline */}
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl sm:leading-tight">
          {selectedCity ? (
            <>
              {t("home.heroTitleCity").split("{city}")[0]}
              <span className="text-rose-500">{selectedCity}</span>
            </>
          ) : (
            <>
              {t("home.heroTitle").split("in Nederland")[0]}
              <span className="text-rose-500">
                {t("home.heroTitle").includes("in Nederland") ? "in Nederland" : t("home.heroTitle")}
              </span>
            </>
          )}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-stone-500 sm:text-lg">
          {selectedCity
            ? t("home.heroSubtitleCity").replace("{city}", selectedCity)
            : t("home.heroSubtitle")}
        </p>

        {/* Search bar */}
        <div className="mt-6">
          <CitySearchAutocomplete />
        </div>

        {/* City quick-links */}
        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {POPULAR_CITIES.map((city) => (
            <Link
              key={city}
              href={`/kamers?city=${encodeURIComponent(city)}`}
              className="rounded-full border border-stone-200 bg-white px-3.5 py-1 text-xs font-medium text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-600 active:scale-[0.96]"
            >
              {city}
            </Link>
          ))}
        </div>

        {/* Category chips */}
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Link href="/kamers?type=room_for_rent" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-500 active:scale-[0.96]">{t("home.typeRoom")}</Link>
          <Link href="/kamers?q=appartement" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-500 active:scale-[0.96]">{t("home.typeApartment")}</Link>
          <Link href="/kamers?q=studio" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-500 active:scale-[0.96]">{t("home.typeStudio")}</Link>
          <Link href="/kamers?type=short_stay" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-500 active:scale-[0.96]">{t("home.typeShortStay")}</Link>
          <Link href="/kamers?max=800" className="rounded-full border border-stone-100 bg-stone-50 px-3.5 py-1 text-xs text-stone-500 transition hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-500 active:scale-[0.96]">{t("home.budgetChip").replace("{max}", "800")}</Link>
        </div>

        {/* Trust micro-copy */}
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("home.trustVerified")}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {t("home.trustDirect")}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t("home.trustFast")}
          </span>
        </div>

      </div>
    </section>
  );
}
