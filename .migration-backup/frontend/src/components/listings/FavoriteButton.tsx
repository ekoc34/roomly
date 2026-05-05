"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/favorites";
import { useRouter } from "next/navigation";

type Props = {
  listingId: string;
  initialFavorited: boolean;
  variant?: "card" | "detail";
};

export function FavoriteButton({ listingId, initialFavorited, variant = "card" }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const prev = favorited;
      setFavorited(!prev);
      const res = await toggleFavorite(listingId);
      if ("error" in res) {
        setFavorited(prev);
        if (res.error === "not_authenticated") {
          router.push(`/inloggen?next=/kamers/${listingId}`);
        }
      } else {
        setFavorited(res.favorited);
      }
    });
  };

  const sizing =
    variant === "detail"
      ? "h-11 w-11"
      : "h-9 w-9";

  return (
    <button
      type="button"
      aria-label={favorited ? "Verwijder uit favorieten" : "Opslaan in favorieten"}
      data-testid={`favorite-button-${listingId}`}
      onClick={onClick}
      disabled={isPending}
      className={`absolute right-3 top-3 z-10 flex ${sizing} items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition active:scale-90 ${
        favorited
          ? "border-rose-200 bg-white/95 text-rose-500 hover:bg-rose-50"
          : "border-stone-200 bg-white/95 text-stone-500 hover:border-rose-200 hover:text-rose-500"
      }`}
    >
      <svg
        className="h-5 w-5"
        fill={favorited ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
