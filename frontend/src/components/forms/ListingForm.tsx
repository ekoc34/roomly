"use client";

import { useState } from "react";
import { createListing, updateListing } from "@/app/actions/listings";
import { AMSTERDAM_DISTRICTS, LISTING_TYPE_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Listing, ListingType } from "@/types/database";

const TYPES = Object.keys(LISTING_TYPE_LABELS) as ListingType[];

const inputClass =
  "mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";

type Props = {
  mode: "create" | "edit";
  listing?: Listing;
};

export function ListingForm({ mode, listing }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(listing?.images ?? []);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Je moet ingelogd zijn om foto te uploaden.");
        return;
      }
      const next: string[] = [...imageUrls];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const safeName = file.name.replace(/\s+/g, "-");
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("listing-images")
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError("Upload mislukt. Probeer opnieuw.");
          continue;
        }
        const { data: pub } = supabase.storage
          .from("listing-images")
          .getPublicUrl(path);
        next.push(pub.publicUrl);
      }
      setImageUrls(next);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  const formAction =
    mode === "create"
      ? createListing
      : listing
        ? updateListing.bind(null, listing.id)
        : createListing;

  return (
    <form
      action={async (fd: FormData) => {
        setError(null);
        fd.set("images_json", JSON.stringify(imageUrls));
        const res = await formAction(fd);
        if (res && "error" in res && res.error) {
          setError(res.error);
        }
      }}
      className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-8"
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-stone-700">
          Titel
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={listing?.title}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          Beschrijving
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          defaultValue={listing?.description}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-stone-700">
            Prijs per maand (EUR)
          </label>
          <input
            id="price"
            name="price"
            type="text"
            inputMode="decimal"
            required
            defaultValue={listing?.price != null ? String(listing.price) : ""}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="availability_date"
            className="block text-sm font-medium text-stone-700"
          >
            Beschikbaar per (optioneel)
          </label>
          <input
            id="availability_date"
            name="availability_date"
            type="date"
            defaultValue={
              listing?.availability_date ? listing.availability_date.slice(0, 10) : ""
            }
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-stone-700">
            Locatie (stadsdeel)
          </label>
          <select
            id="location"
            name="location"
            required
            defaultValue={listing?.location}
            className={inputClass}
          >
            <option value="">Kies</option>
            {AMSTERDAM_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-stone-700">
            Type advertentie
          </label>
          <select
            id="type"
            name="type"
            required
            defaultValue={listing?.type}
            className={inputClass}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {LISTING_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-stone-700">Foto</p>
        <input
          type="file"
          accept="image/*"
          multiple
          className="mt-2 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-rose-700"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        {uploading ? (
          <p className="mt-2 text-xs text-stone-500">Uploaden</p>
        ) : null}
        {imageUrls.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {imageUrls.map((url) => (
              <li
                key={url}
                className="relative h-20 w-28 overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="w-full rounded-2xl bg-rose-500 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60"
      >
        {mode === "create" ? "Advertentie plaatsen" : "Wijzigingen opslaan"}
      </button>
    </form>
  );
}
