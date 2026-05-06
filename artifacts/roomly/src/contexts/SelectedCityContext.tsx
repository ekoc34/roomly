import { createContext, useContext, useState, type ReactNode } from "react";

export const DUTCH_CITIES = [
  "Amsterdam",
  "Rotterdam",
  "Den Haag",
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

export type DutchCity = (typeof DUTCH_CITIES)[number];

type SelectedCityContextType = {
  selectedCity: string | null;
  setSelectedCity: (city: string | null) => void;
};

const SelectedCityContext = createContext<SelectedCityContextType>({
  selectedCity: null,
  setSelectedCity: () => {},
});

export function SelectedCityProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  return (
    <SelectedCityContext.Provider value={{ selectedCity, setSelectedCity }}>
      {children}
    </SelectedCityContext.Provider>
  );
}

export function useSelectedCity() {
  return useContext(SelectedCityContext);
}
