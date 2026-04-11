"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  images: string[];
  title: string;
};

export function DetailGallery({ images, title }: Props) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? null;

  if (!main) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        Geen foto
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 shadow-sm">
        <Image
          src={main}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 720px"
          priority
        />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === active ? "border-rose-500" : "border-transparent"
              }`}
              aria-label={`Foto ${i + 1}`}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="96px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
