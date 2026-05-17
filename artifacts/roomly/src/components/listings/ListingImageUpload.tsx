import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const MAX_IMAGES = 6;
const MAX_SIZE_MB = 5;
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
};

/** Extract the storage object path from a Supabase public URL. */
function extractStoragePath(url: string): string | null {
  const marker = "/object/public/listings/";
  const idx = url.indexOf(marker);
  return idx !== -1 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
}

/** Resize an image to fit within MAX_DIMENSION × MAX_DIMENSION and re-encode as JPEG. */
function resizeImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      let tw = w;
      let th = h;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) { tw = MAX_DIMENSION; th = Math.round(h * (MAX_DIMENSION / w)); }
        else { th = MAX_DIMENSION; tw = Math.round(w * (MAX_DIMENSION / h)); }
      }
      if (tw === w && th === h && file.type === "image/jpeg") {
        resolve(file);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, tw, th);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

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
    for (const rawFile of selected) {
      const file = await resizeImage(rawFile);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `listings/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        toast.error(`Upload mislukt: ${rawFile.name}`);
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

  const remove = (i: number) => {
    const url = value[i];
    onChange(value.filter((_, idx) => idx !== i));
    // S-02: delete the file from storage immediately (fire-and-forget).
    if (supabase && url) {
      const path = extractStoragePath(url);
      if (path) {
        supabase.storage.from("listings").remove([path]).catch(() => {});
      }
    }
  };

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
          <span className="text-xs">JPG, PNG, WEBP — max {MAX_SIZE_MB} MB per foto, automatisch verkleind tot 1280 px</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-stone-100">
              <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
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
