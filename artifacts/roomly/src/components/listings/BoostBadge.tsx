export const BOOST_WINDOW_MS = 60 * 60 * 1000;

const StarIcon = () => (
  <svg className="h-2.5 w-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
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
    <span className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-600 ${className}`}>
      <StarIcon />
      Uitgelicht
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
