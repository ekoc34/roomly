import { useLocation } from "wouter";
import { X, Scale, Trash2 } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Listing } from "@/types/database";

export function CompareBar() {
  const { compareIds, remove, clear } = useCompare();
  const [, navigate] = useLocation();
  const [thumbnails, setThumbnails] = useState<Map<string, Listing>>(new Map());

  useEffect(() => {
    if (!supabase || compareIds.length === 0) return;
    supabase
      .from("listings")
      .select("id, title, images, price")
      .in("id", compareIds)
      .then(({ data }) => {
        if (!data) return;
        setThumbnails(new Map(data.map((l) => [l.id, l as Listing])));
      });
  }, [compareIds]);

  if (compareIds.length === 0) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 flex justify-center px-4 md:bottom-4">
      <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-xl">
        {/* Thumbnails */}
        <div className="flex shrink-0 items-center gap-2">
          {compareIds.map((id) => {
            const listing = thumbnails.get(id);
            const img = listing?.images?.[0];
            return (
              <div key={id} className="relative">
                <div className="h-11 w-11 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                  {img ? (
                    <img src={img} alt={listing?.title ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Scale className="h-4 w-4 text-stone-300" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-white hover:bg-rose-500 transition"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Count label */}
        <span className="flex-1 text-sm text-stone-500">
          <span className="font-semibold text-stone-800">{compareIds.length}</span> van 3 woningen geselecteerd
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 hover:border-stone-300 hover:text-stone-700 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Wissen
          </button>
          <button
            type="button"
            onClick={() => navigate(`/vergelijk?ids=${compareIds.join(",")}`)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-600 transition active:scale-95"
          >
            <Scale className="h-3.5 w-3.5" />
            Vergelijk
          </button>
        </div>
      </div>
    </div>
  );
}
