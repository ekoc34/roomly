import type { Profile } from "@/types/database";

type Props = {
  profile: Profile | null;
  memberSince: string;
};

export function OwnerBadges({ profile, memberSince }: Props) {
  const joinMonth = new Date(memberSince).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  const initial = (profile?.name ?? profile?.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm" data-testid="owner-badges">
      <h2 className="text-sm font-semibold text-stone-900">Over de plaatser</h2>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-stone-500">{initial}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{profile?.name ?? "Roomly gebruiker"}</p>
          <p className="text-xs text-stone-500">Lid sinds {joinMonth}</p>
        </div>
      </div>
      {profile?.bio && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{profile.bio}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          E-mail account
        </span>
        {(profile?.email_auto_verified || profile?.student_verified) && (
          <span className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" /></svg>
            Geverifieerde student
          </span>
        )}
        {profile?.phone_verified && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            Telefoon geverifieerd
          </span>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Chat altijd via Roomly. Maak nooit geld over en deel geen ID-bewijs voordat je de woning hebt gezien.
      </p>
    </div>
  );
}
