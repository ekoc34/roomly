import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import {
  getActiveStatus,
  getResponseRateBadge,
  computeResponseStats,
  type AppStat,
} from "@/lib/landlordUtils";
import { isFullyVerified, isPartiallyVerified } from "@/lib/verificationUtils";

function PersonSilhouette() {
  return (
    <span className="flex h-full w-full items-center justify-center">
      <svg className="h-6 w-6 text-stone-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </span>
  );
}

type OtherApp = {
  id: string;
  status: string;
  listings: { title: string; user_id: string } | null;
};

type OtherListing = {
  id: string;
  title: string;
  price: number | null;
  location: string | null;
  images: string[] | null;
};

type Props = {
  profileId: string | null;
  onClose: () => void;
  mode?: "applicant" | "landlord";
  viewerUserId?: string;
  viewerLandlordId?: string;
  applicationId?: string;
  currentListingId?: string;
};

const statusMap: Record<string, { label: string; cls: string }> = {
  pending:  { label: "In behandeling", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Geaccepteerd",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Afgewezen",      cls: "bg-stone-100 text-stone-500 border-stone-200" },
};

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  const prefix = atIdx > 0 ? email.slice(0, Math.min(3, atIdx)) : email.slice(0, 3);
  return `${prefix}***@***`;
}

function maskPhone(phone: string): string {
  return phone.slice(0, 4) + "*** ***";
}

function formatAvgResponseTime(hours: number): string {
  if (hours < 24) {
    return `Reageert binnen ${Math.round(hours)} uur`;
  }
  const days = Math.round(hours / 24);
  return `Reageert binnen ${days} ${days === 1 ? "dag" : "dagen"}`;
}

export function ApplicantProfilePanel({
  profileId,
  onClose,
  mode = "applicant",
  viewerUserId,
  viewerLandlordId,
  applicationId,
  currentListingId,
}: Props) {
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [otherApps, setOtherApps] = useState<OtherApp[]>([]);
  const [otherListings, setOtherListings] = useState<OtherListing[]>([]);
  const [listingsCount, setListingsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [appStats, setAppStats] = useState<{ rate: number; avgHours: number | null } | null>(null);

  useEffect(() => {
    if (!profileId || !supabase) {
      setProfile(null); setOtherApps([]); setHasConversation(false); setAppStats(null);
      return;
    }
    setLoading(true);
    setEmailRevealed(false);
    setHasConversation(false);
    setAppStats(null);

    if (mode === "landlord") {
      const viewerId = viewerUserId;
      Promise.all([
        supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("user_id", profileId),
        viewerId
          ? supabase
              .from("conversations")
              .select("id", { count: "exact", head: true })
              .or(`and(tenant_id.eq.${viewerId},landlord_id.eq.${profileId}),and(landlord_id.eq.${viewerId},tenant_id.eq.${profileId})`)
          : Promise.resolve({ count: 0 }),
        supabase
          .from("applications")
          .select("status, created_at, updated_at, listings!inner(user_id)")
          .eq("listings.user_id", profileId),
      ]).then(([{ data: p }, { count }, { count: convCount }, { data: stats }]) => {
        setProfile(p as Profile | null);
        setListingsCount(count ?? 0);
        setHasConversation((convCount ?? 0) > 0);
        const computed = computeResponseStats((stats as AppStat[] | null) ?? [], profileId);
        setAppStats(computed);
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
        setHasConversation(true);
        setLoading(false);
      });
    }
  }, [profileId, mode, viewerUserId, viewerLandlordId]);

  useEffect(() => {
    if (!profileId || !supabase) { setOtherListings([]); return; }
    let query = supabase
      .from("listings")
      .select("id, title, price, location, images")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(currentListingId ? 6 : 5);
    if (currentListingId) query = query.neq("id", currentListingId);
    query.then(({ data }) => {
      const rows = (data ?? []) as OtherListing[];
      setOtherListings(currentListingId ? rows.slice(0, 5) : rows);
    });
  }, [profileId, currentListingId]);

  const handleRevealEmail = async () => {
    setRevealing(true);
    if (applicationId && supabase) {
      await supabase.from("applications").update({ contact_revealed: true }).eq("id", applicationId);
    }
    setEmailRevealed(true);
    setRevealing(false);
  };

  if (!profileId) return null;

  const initial = (profile?.name ?? profile?.email ?? "?").slice(0, 1).toUpperCase();
  const isLandlord = mode === "landlord";

  const fullyVerified = isFullyVerified(null, profile);
  const partiallyVerified = isPartiallyVerified(null, profile);
  const activeStatus = isLandlord ? getActiveStatus(profile?.last_active_at) : null;
  const responseRateBadge = isLandlord && appStats ? getResponseRateBadge(appStats.rate) : null;

  const canSeeEmail = hasConversation && (profile?.show_email === true);
  const canSeePhone = hasConversation && (profile?.show_phone === true);
  const contactHidden = (!canSeeEmail && !canSeePhone) && (!!profile?.email || !!profile?.phone);

  const panelTitle = isLandlord ? "Verhuurder" : "Aanvrager";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">

        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <p className="text-sm font-semibold text-stone-900">{panelTitle}</p>
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
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-stone-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-stone-200" />
                <div className="h-3 w-1/3 animate-pulse rounded-full bg-stone-200" />
              </div>
            </div>
            <div className="h-16 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-12 animate-pulse rounded-xl bg-stone-100" />
          </div>
        ) : (
          <div className="flex flex-col gap-0 divide-y divide-stone-100">

            {/* Identity block */}
            <div className="flex items-start gap-3 p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                {profile?.show_avatar_in_listings === false ? (
                  <PersonSilhouette />
                ) : profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-stone-500">{initial}</span>
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-base font-semibold text-stone-900">{profile?.name ?? "Welkthuis gebruiker"}</p>
                  {activeStatus && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${activeStatus.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${activeStatus.dot}`} />
                      {activeStatus.label}
                    </span>
                  )}
                </div>

                {/* Role */}
                <p className="mt-0.5 text-xs text-stone-400 capitalize">
                  {isLandlord ? "Verhuurder" : (profile?.user_type?.replace("_", " ") ?? "Huurder")}
                </p>

                {/* Single verification status */}
                <div className="mt-2">
                  {fullyVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Geverifieerd verhuurder
                    </span>
                  ) : partiallyVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      Gedeeltelijk geverifieerd
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      E-mail bevestigd
                    </span>
                  )}
                </div>

                {/* Response stats — landlord only */}
                {isLandlord && (responseRateBadge || appStats?.avgHours != null || listingsCount > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {responseRateBadge && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${responseRateBadge.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${responseRateBadge.dot}`} />
                        {responseRateBadge.label} respons
                      </span>
                    )}
                    {appStats?.avgHours != null && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatAvgResponseTime(appStats.avgHours)}
                      </span>
                    )}
                    {listingsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        {listingsCount} advertentie{listingsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile?.bio && (
              <div className="px-5 py-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Over</p>
                <p className="line-clamp-5 text-sm leading-relaxed text-stone-600">{profile.bio}</p>
              </div>
            )}

            {/* Contact — landlord mode */}
            {isLandlord && (profile?.email || profile?.phone) && (
              <div className="px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Contact</p>
                {contactHidden ? (
                  <p className="flex items-start gap-1.5 text-xs text-stone-400">
                    <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Contactgegevens zijn privé. Stuur een bericht via het platform.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {profile?.email && canSeeEmail && (
                      <p className="break-all text-sm text-stone-700">{profile.email}</p>
                    )}
                    {profile?.email && !canSeeEmail && !contactHidden && (
                      <p className="text-xs text-stone-400 italic">E-mail verborgen</p>
                    )}
                    {profile?.phone && canSeePhone && (
                      <p className="text-sm text-stone-700">{profile.phone}</p>
                    )}
                    {profile?.phone && !canSeePhone && !contactHidden && (
                      <p className="text-xs text-stone-400 italic">Telefoon verborgen</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Contact — applicant mode with reveal */}
            {!isLandlord && profile?.email && (
              <div className="px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Contact</p>
                {!canSeeEmail ? (
                  <p className="text-xs italic text-stone-400">Aanvrager heeft e-mailadres verborgen.</p>
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
                      {revealing ? "…" : "Toon"}
                    </button>
                  </div>
                )}
                {profile?.phone && (
                  <div className="mt-1.5">
                    {!canSeePhone ? (
                      <p className="text-xs italic text-stone-400">Telefoon verborgen.</p>
                    ) : (
                      <p className="text-sm text-stone-700">{maskPhone(profile.phone)}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Applicant — application history */}
            {!isLandlord && (
              <div className="px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Aanvragen op jouw advertenties{otherApps.length > 0 ? ` (${otherApps.length})` : ""}
                </p>
                {otherApps.length === 0 ? (
                  <p className="text-xs text-stone-400">Geen aanvragen gevonden.</p>
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

            {/* Other listings by this user */}
            {otherListings.length > 0 && (
              <div className="px-5 py-4">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  Andere advertenties ({otherListings.length})
                </p>
                <div className="flex flex-col gap-2">
                  {otherListings.map((listing) => {
                    const thumb = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0] : null;
                    return (
                      <button
                        key={listing.id}
                        type="button"
                        onClick={() => { navigate(`/kamers/${listing.id}`); onClose(); }}
                        className="flex w-full items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-left transition hover:border-rose-200 hover:bg-rose-50/40"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-200">
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-stone-800">{listing.title}</p>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            {listing.price != null ? `€ ${listing.price.toLocaleString("nl-NL")}/mnd` : "Prijs op aanvraag"}
                            {listing.location ? ` · ${listing.location}` : ""}
                          </p>
                        </div>
                        <svg className="h-3.5 w-3.5 shrink-0 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Safety footer */}
            <div className="px-5 py-4">
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-stone-400">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Chat altijd via Welkthuis. Betaal nooit voordat je de woning hebt bezichtigd.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
