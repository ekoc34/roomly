import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const MAX_COMPARE = 3;
const STORAGE_KEY = "welkthuis_compare_ids";

type CompareContextType = {
  compareIds: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
};

const CompareContext = createContext<CompareContextType>({
  compareIds: [],
  toggle: () => {},
  remove: () => {},
  clear: () => {},
  isSelected: () => false,
});

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  const toggle = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        toast.warning("Je kunt maximaal 3 woningen vergelijken.");
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clear = useCallback(() => setCompareIds([]), []);

  const isSelected = useCallback((id: string) => compareIds.includes(id), [compareIds]);

  return (
    <CompareContext.Provider value={{ compareIds, toggle, remove, clear, isSelected }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
