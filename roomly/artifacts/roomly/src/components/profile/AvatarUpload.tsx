import { useRef, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  currentUrl: string | null | undefined;
  onUploaded: (url: string) => void;
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const TARGET_SIZE = 256; // px — square crop

async function cropAndResizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d")!;
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to blob failed"));
      }, "image/jpeg", 0.9);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export function AvatarUpload({ userId, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Alleen afbeeldingsbestanden zijn toegestaan (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Bestand is te groot. Maximum is 5 MB.");
      return;
    }

    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }

      let blob: Blob;
      try {
        blob = await cropAndResizeImage(file);
      } catch {
        setError("Kan afbeelding niet verwerken. Probeer een ander bestand.");
        return;
      }

      const previewUrl = URL.createObjectURL(blob);
      setPreview(previewUrl);

      const ext = "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadErr) {
        setPreview(null);
        setError(`Upload mislukt: ${uploadErr.message}`);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateErr) {
        setError("Foto geüpload maar profiel bijwerken mislukt.");
        return;
      }

      onUploaded(publicUrl);
    });
  };

  const displayUrl = preview ?? currentUrl;
  const initial = userId.slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        data-testid="avatar-upload-button"
        className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-stone-300 bg-stone-100 transition hover:border-rose-400 hover:bg-rose-50 disabled:opacity-60"
        aria-label="Profielfoto uploaden"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profielfoto"
            className="h-full w-full object-cover"
            data-testid="avatar-preview"
          />
        ) : (
          <span className="text-2xl font-bold text-stone-400">{initial}</span>
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition group-hover:bg-black/30">
          {isPending ? (
            <svg className="h-6 w-6 animate-spin text-white opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <svg className="h-6 w-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="avatar-file-input"
      />

      <div className="text-center">
        <p className="text-xs font-medium text-stone-600">
          {isPending ? "Uploaden…" : "Klik om een foto te kiezen"}
        </p>
        <p className="mt-0.5 text-[11px] text-stone-400">
          JPG, PNG of WebP · Max 5 MB · Automatisch bijgesneden tot vierkant
        </p>
      </div>

      {error && (
        <p className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
