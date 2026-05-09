import { Scale } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";

export function CompareButton({ listingId }: { listingId: string }) {
  const { toggle, isSelected } = useCompare();
  const selected = isSelected(listingId);

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(listingId); }}
      title={selected ? "Verwijder uit vergelijking" : "Voeg toe aan vergelijking"}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition active:scale-95 ${
        selected
          ? "border-rose-400 bg-rose-500 text-white shadow-sm"
          : "border-stone-200 bg-white text-stone-500 hover:border-rose-300 hover:text-rose-600"
      }`}
    >
      <Scale className="h-3 w-3" />
      {selected ? "Geselecteerd" : "Vergelijk"}
    </button>
  );
}
