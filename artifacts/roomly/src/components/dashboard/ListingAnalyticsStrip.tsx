import { Eye, MessageSquare, Zap } from "lucide-react";
import { BoostCountdown, BOOST_WINDOW_MS } from "@/components/listings/BoostBadge";

type Props = {
  viewCount: number;
  conversationCount: number;
  boosted: boolean;
  boostedAt: string | null;
};

function AnalyticsStat({
  icon,
  label,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  empty: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${empty ? "text-stone-300" : "text-stone-500"}`}
    >
      <span className="shrink-0 opacity-70">{icon}</span>
      {label}
    </span>
  );
}

function Divider() {
  return (
    <span className="select-none text-stone-200" aria-hidden>
      ·
    </span>
  );
}

export function ListingAnalyticsStrip({
  viewCount,
  conversationCount,
  boosted,
  boostedAt,
}: Props) {
  const msLeft =
    boosted && boostedAt
      ? new Date(boostedAt).getTime() + BOOST_WINDOW_MS - Date.now()
      : 0;
  const boostStillActive = msLeft > 0;

  return (
    <div className="mt-2.5 border-t border-stone-100 pt-2.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
        <AnalyticsStat
          icon={<Eye className="h-3 w-3" />}
          label={viewCount > 0 ? `${viewCount} weergaven` : "Nog geen weergaven"}
          empty={viewCount === 0}
        />

        <Divider />

        <AnalyticsStat
          icon={<MessageSquare className="h-3 w-3" />}
          label={
            conversationCount > 0
              ? `${conversationCount} ${conversationCount === 1 ? "reactie" : "reacties"}`
              : "Nog geen reacties"
          }
          empty={conversationCount === 0}
        />

        <Divider />

        {boostStillActive ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
            Meer zichtbaarheid actief
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-stone-300">
            <Zap className="h-3 w-3 opacity-50" />
            Normale zichtbaarheid
          </span>
        )}
      </div>

      {boostStillActive && boostedAt && (
        <BoostCountdown boostedAt={boostedAt} className="mt-1" />
      )}
    </div>
  );
}
