import { createContext, useContext, useState, type ReactNode } from "react";

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
