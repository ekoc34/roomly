import { useState } from "react";
import { useSelectedCity, DUTCH_CITIES } from "@/contexts/SelectedCityContext";

export function CitySelector() {
  const { selectedCity, setSelectedCity } = useSelectedCity();
  const [isOpen, setIsOpen] = useState(false);
  const displayCity = selectedCity ?? "Amsterdam";

  const isActive = selectedCity !== null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${
          isActive
            ? "border-rose-400 bg-rose-50 text-rose-500 hover:border-rose-500 hover:bg-rose-100"
            : "border-stone-200 bg-white text-stone-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
        }`}
      >
        <svg className={`h-4 w-4 ${isActive ? "text-rose-500" : "text-stone-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {displayCity}
        <svg className={`h-3 w-3 ${isActive ? "text-rose-400" : "text-stone-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-lg">
            <p className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">
              Selecteer een stad
            </p>
            {DUTCH_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => { setSelectedCity(city); setIsOpen(false); }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  selectedCity === city ? "bg-rose-50 text-rose-700" : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
