import { AlertTriangle } from "lucide-react";
import type { Profile } from "@/types/database";
import { isFullyVerified, isPartiallyVerified } from "@/lib/verificationUtils";

const USER_TYPE_LABELS: Record<string, string> = {
  verhuurder:        "Verhuurder",
  huisgenoot_zoeker: "Huisgenoot zoeker",
  student:           "Student",
  professional:      "Professional / Expat",
  alleenstaande:     "Alleenstaande",
  family:            "Familie",
};

type Props = {
  profile: Profile | null;
  memberSince: string;
  onNameClick?: () => void;
};

export function OwnerBadges({ profile, memberSince, onNameClick }: Props) {
  const joinMonth = new Date(memberSince).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  const initial = (profile?.name ?? profile?.email ?? "?").slice(0, 1).toUpperCase();
  const roleLabel = (profile?.user_type && USER_TYPE_LABELS[profile.user_type]) ?? "Gebruiker";

  const fullyVerified = isFullyVerified(profile);
  const partiallyVerified = isPartiallyVerified(profile);
  const isScamFlagged = profile?.scam_flagged === true;

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm" data-testid="owner-badges">
      {isScamFlagged && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs leading-relaxed text-amber-800">
            <span className="font-semibold">Let op:</span> Deze verhuurder heeft meldingen ontvangen. Chat altijd via het platform.
          </p>
        </div>
      )}

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">{roleLabel}</p>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-stone-500">{initial}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {onNameClick ? (
              <button
                type="button"
                onClick={onNameClick}
                className="truncate text-sm font-semibold text-stone-900 hover:text-rose-600 hover:underline"
              >
                {profile?.name ?? "Welkthuis gebruiker"}
              </button>
            ) : (
              <p className="truncate text-sm font-semibold text-stone-900">{profile?.name ?? "Welkthuis gebruiker"}</p>
            )}
            {fullyVerified && (
              <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 24 24" title="Geverifieerd">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-stone-400">Lid sinds {joinMonth}</p>
        </div>
      </div>

      {/* Single verification status line */}
      <div className="mt-3">
        {fullyVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Geverifieerd verhuurder
          </span>
        ) : partiallyVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Gedeeltelijk geverifieerd
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-500">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            E-mail bevestigd
          </span>
        )}
      </div>

      {profile?.bio && (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-500">{profile.bio}</p>
      )}

      {/* Safety tip — compact single line */}
      <p className="mt-4 flex items-start gap-1.5 border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-400">
        <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Chat altijd via Welkthuis. Betaal nooit voordat je de woning hebt gezien.
      </p>
    </div>
  );
}
