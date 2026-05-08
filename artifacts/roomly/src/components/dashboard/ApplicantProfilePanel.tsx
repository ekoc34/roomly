import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

type OtherApp = {
  id: string;
  status: string;
  listings: { title: string; user_id: string } | null;
};

type Props = {
  profileId: string | null;
  onClose: () => void;
  mode?: "applicant" | "landlord";
  viewerLandlordId?: string;
  applicationId?: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending: { label: "In behandeling", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Geaccepteerd", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Afgewezen", cls: "bg-stone-100 text-stone-500 border-stone-200" },
};

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  const prefix = atIdx > 0 ? email.slice(0, Math.min(3, atIdx)) : email.slice(0, 3);
  return `${prefix}***@***`;
}

export function ApplicantProfilePanel({
  profileId,
  onClose,
  mode = "applicant",
  viewerLandlordId,
  applicationId,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [otherApps, setOtherApps] = useState<OtherApp[]>([]);
  const [listingsCount, setListingsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (!profileId || !supabase) { setProfile(null); setOtherApps([]); return; }
    setLoading(true);
    setEmailRevealed(false);

    if (mode === "landlord") {
      Promise.all([
        supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("user_id", profileId),
      ]).then(([{ data: p }, { count }]) => {
        setProfile(p as Profile | null);
        setListingsCount(count ?? 0);
        setLoading(false);
      });
    } else {
      Promise.all([
        supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
        supabase
          .from("applications")
          .select("id, status, listings:listing_id(title, user_id)")
          .eq("applicant_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]).then(([{ data: p }, { data: apps }]) => {
        setProfile(p as Profile | null);
        const allApps = (apps as OtherApp[] | null) ?? [];
        const filtered = viewerLandlordId
          ? allApps.filter((a) => (a.listings as { user_id: string } | null)?.user_id === viewerLandlordId)
          : allApps;
        setOtherApps(filtered);
        setLoading(false);
      });
    }
  }, [profileId, mode, viewerLandlordId]);

  const handleRevealEmail = async () => {
    setRevealing(true);
    if (applicationId && supabase) {
      await supabase
        .from("applications")
        .update({ contact_revealed: true })
        .eq("id", applicationId);
    }
    setEmailRevealed(true);
    setRevealing(false);
  };

  if (!profileId) return null;

  const initial = (profile?.name ?? profile?.email ?? "?").slice(0, 1).toUpperCase();
  const isLandlord = mode === "landlord";
  const panelTitle = isLandlord ? "Verhuurder profiel" : "Aanvrager profiel";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-900">{panelTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse rounded-full bg-stone-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-stone-200" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-stone-200" />
              </div>
            </div>
            <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 shadow-sm">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-stone-500">{initial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-stone-900">{profile?.name ?? "Onbekend"}</p>
                <p className="mt-0.5 text-xs text-stone-400 capitalize">
                  {isLandlord ? "Verhuurder" : (profile?.user_type?.replace("_", " ") ?? "Huurder")}
                </p>

                {profile?.email && (
                  <div className="mt-1.5">
                    {isLandlord ? (
                      <p className="text-xs italic text-stone-400">E-mail verborgen voor privacy.</p>
                    ) : emailRevealed ? (
                      <p className="break-all text-sm text-stone-700">{profile.email}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-stone-500">{maskEmail(profile.email)}</p>
                        <button
                          type="button"
                          onClick={handleRevealEmail}
                          disabled={revealing}
                          className="shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                        >
                          {revealing ? "…" : "Toon e-mailadres"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(profile?.verification_badge ||
              profile?.phone_verified ||
              profile?.email_auto_verified ||
              profile?.student_verified) && (
              <div className="flex flex-wrap gap-2">
                {profile?.verification_badge && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    {profile.verification_badge}
                  </span>
                )}
                {profile?.student_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                    Student geverifieerd
                  </span>
                )}
                {profile?.email_auto_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    E-mail geverifieerd
                  </span>
                )}
                {profile?.phone_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Telefoon geverifieerd
                  </span>
                )}
              </div>
            )}

            {profile?.bio ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Over mij</p>
                <p className="text-sm leading-relaxed text-stone-700">{profile.bio}</p>
              </div>
            ) : (
              <p className="text-sm italic text-stone-400">Geen bio ingevuld.</p>
            )}

            {isLandlord ? (
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Advertenties</p>
                <p className="mt-1 text-2xl font-black text-stone-900">
                  {listingsCount}
                  <span className="ml-1.5 text-sm font-normal text-stone-500">
                    actieve advertentie{listingsCount !== 1 ? "s" : ""}
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Aanvragen op jouw advertenties ({otherApps.length})
                </p>
                {otherApps.length === 0 ? (
                  <p className="text-sm text-stone-400">Geen aanvragen op jouw advertenties gevonden.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {otherApps.map((app) => {
                      const badge = statusMap[app.status] ?? statusMap.pending;
                      return (
                        <div key={app.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
                          <p className="truncate text-xs font-medium text-stone-700">
                            {app.listings?.title ?? "Onbekende woning"}
                          </p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
