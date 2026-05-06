import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const MAX_IMAGES = 6;
const MAX_SIZE_MB = 5;

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
};

export function ListingImageUpload({ value, onChange }: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !supabase || !user) return;
    const remaining = MAX_IMAGES - value.length;
    if (remaining <= 0) {
      toast.error(`Maximaal ${MAX_IMAGES} foto's toegestaan.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    const oversized = selected.filter((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`Foto's mogen maximaal ${MAX_SIZE_MB} MB zijn.`);
      return;
    }
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of selected) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: false });
      if (error) {
        toast.error(`Upload mislukt: ${file.name}`);
        continue;
      }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
      toast.success(`${uploaded.length} foto${uploaded.length > 1 ? "'s" : ""} geüpload`);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-stone-700">
          Foto's <span className="text-stone-400">({value.length}/{MAX_IMAGES})</span>
        </label>
        {value.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
          >
            {uploading ? "Uploaden…" : "+ Foto's toevoegen"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {value.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 py-8 text-sm text-stone-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span>{uploading ? "Uploaden…" : "Klik om foto's te uploaden"}</span>
          <span className="text-xs">JPG, PNG, WEBP — max {MAX_SIZE_MB} MB per foto</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600"
                aria-label="Verwijder foto"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Hoofdfoto
                </span>
              )}
            </div>
          ))}
          {value.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 text-xs text-stone-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {uploading ? "…" : "Toevoegen"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
