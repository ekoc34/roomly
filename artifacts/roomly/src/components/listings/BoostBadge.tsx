import { useState, useEffect } from "react";

export const BOOST_WINDOW_MS = 60 * 60 * 1000;

const LightningIcon = ({ className = "h-2.5 w-2.5" }: { className?: string }) => (
  <svg className={`${className} shrink-0`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
  </svg>
);

type Props = {
  boostedAt: string;
  className?: string;
};

export function BoostBadge({ boostedAt, className = "" }: Props) {
  const msLeft = new Date(boostedAt).getTime() + BOOST_WINDOW_MS - Date.now();
  if (msLeft <= 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white shadow-sm ${className}`}
    >
      <LightningIcon />
      Uitgelicht
    </span>
  );
}

function formatRemaining(msLeft: number): string {
  const totalMinutes = Math.ceil(msLeft / 60_000);
  if (totalMinutes >= 60) return "1u";
  return `${totalMinutes}m`;
}

export function BoostCountdown({ boostedAt, className = "" }: Props) {
  const [msLeft, setMsLeft] = useState(() => new Date(boostedAt).getTime() + BOOST_WINDOW_MS - Date.now());

  useEffect(() => {
    const update = () => setMsLeft(new Date(boostedAt).getTime() + BOOST_WINDOW_MS - Date.now());
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [boostedAt]);

  if (msLeft <= 0) return null;

  const isUrgent = msLeft < 10 * 60 * 1000;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${isUrgent ? "text-amber-600" : "text-stone-400"} ${className}`}
    >
      <LightningIcon className="h-3 w-3" />
      Boost actief · {formatRemaining(msLeft)} resterend
    </span>
  );
}

export function sortByBoost<T extends { boosted_at?: string | null; created_at: string }>(items: T[]): T[] {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aActive = !!a.boosted_at && new Date(a.boosted_at).getTime() + BOOST_WINDOW_MS > now;
    const bActive = !!b.boosted_at && new Date(b.boosted_at).getTime() + BOOST_WINDOW_MS > now;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
