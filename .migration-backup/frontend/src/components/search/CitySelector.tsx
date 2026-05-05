"use client";

import { useState } from "react";

// TODO: Replace with API call when expanding to other cities
// For now, this is a UI foundation for multi-city support
const DUTCH_CITIES = [
  "Amsterdam",
  "Rotterdam",
  "The Hague",
  "Utrecht",
  "Eindhoven",
  "Groningen",
  "Leiden",
  "Maastricht",
  "Delft",
  "Tilburg",
  "Breda",
  "Nijmegen",
  "Arnhem",
  "Haarlem",
  "'s-Hertogenbosch",
] as const;

type City = (typeof DUTCH_CITIES)[number];

export function CitySelector() {
  const [selectedCity, setSelectedCity] = useState<City>("Amsterdam");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* City button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
      >
        <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {selectedCity}
        <svg className="h-3 w-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full z-50 mt-2 w-56 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-lg">
            <p className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">
              Select a city
            </p>
            {DUTCH_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => {
                  setSelectedCity(city);
                  setIsOpen(false);
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  selectedCity === city
                    ? "bg-rose-50 text-rose-700"
                    : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Placeholder message - shows when city is selected */}
      {selectedCity !== "Amsterdam" && (
        <p className="mt-2 text-xs text-stone-500">
          Showing listings in {selectedCity}. More cities coming soon.
        </p>
      )}
    </div>
  );
}
