"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversation } from "@/app/actions/messages";

type Props = {
  listingId: string;
  isLoggedIn: boolean;
};

export function ContactButton({ listingId, isLoggedIn }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (!isLoggedIn) {
      router.push(`/inloggen?next=/kamers/${listingId}`);
      return;
    }
    startTransition(async () => {
      const convId = await startConversation(listingId);
      if (convId) {
        router.push(`/berichten/${convId}`);
      } else {
        setError("Gesprek kan niet worden gestart.");
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        data-testid="contact-button"
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {isPending ? "Bezig..." : "Stuur bericht"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
