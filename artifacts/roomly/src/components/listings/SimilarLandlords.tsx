import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import {
  getActiveStatus,
  getResponseRateBadge,
  computeResponseStats,
  extractCity,
  type AppStat,
} from "@/lib/landlordUtils";
import type { Profile } from "@/types/database";

type LandlordCard = {
  profile: Profile;
  listingCount: number;
  responseRate: number | null;
};

type Props = {
  location: string;
  excludeUserId: string;
  viewerUserId?: string;
};

export function SimilarLandlords({ location, excludeUserId, viewerUserId }: Props) {
  const [landlords, setLandlords] = useState<LandlordCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const city = extractCity(location);

  useEffect(() => {
    if (!supabase || !city) { setLoading(false); return; }

    async function fetchLandlords() {
      setLoading(true);

      // Step 1: Get distinct landlord IDs from listings in the same city
      const { data: cityListings } = await supabase!
        .from("listings")
        .select("user_id")
        .ilike("location", `%${city}%`)
        .neq("user_id", excludeUserId)
        .limit(12);

      const landlordIds = [
        ...new Set((cityListings ?? []).map((l: { user_id: string }) => l.user_id)),
      ].slice(0, 4) as string[];

      if (landlordIds.length === 0) {
        setLandlords([]);
        setLoading(false);
        return;
      }

      // Step 2: Batch-fetch profiles, all listings (for count), and application stats
      const [{ data: profiles }, { data: allListings }, { data: appStats }] =
        await Promise.all([
          supabase!.from("profiles").select("*").in("id", landlordIds),
          supabase!
            .from("listings")
            .select("user_id")
            .in("user_id", landlordIds),
          supabase!
            .from("applications")
            .select("status, created_at, updated_at, listings!inner(user_id)")
            .in("listings.user_id", landlordIds),
        ]);

      const listingCountMap: Record<string, number> = {};
      for (const l of allListings ?? []) {
        listingCountMap[l.user_id] = (listingCountMap[l.user_id] ?? 0) + 1;
      }

      const cards: LandlordCard[] = landlordIds
        .map((id) => {
          const profile = (profiles ?? []).find((p: Profile) => p.id === id);
          if (!profile) return null;
          const stats = computeResponseStats((appStats as AppStat[] | null) ?? [], id);
          return {
            profile: profile as Profile,
            listingCount: listingCountMap[id] ?? 0,
            responseRate: stats ? stats.rate : null,
          };
        })
        .filter(Boolean) as LandlordCard[];

      setLandlords(cards);
      setLoading(false);
    }

    fetchLandlords();
  }, [location, excludeUserId, city]);

  if (loading) {
    return (
      <section className="mt-10 border-t border-stone-100 pt-8">
        <div className="mb-4 h-6 w-64 animate-pulse rounded-full bg-stone-200" />
        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="min-w-[220px] animate-pulse rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 rounded-full bg-stone-200" />
                  <div className="h-2.5 w-20 rounded-full bg-stone-200" />
                </div>
              </div>
              <div className="mt-4 h-8 rounded-xl bg-stone-200" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      {selectedId && (
        <ApplicantProfilePanel
          profileId={selectedId}
          mode="landlord"
          viewerUserId={viewerUserId}
          onClose={() => setSelectedId(null)}
        />
      )}

      <section className="mt-10 border-t border-stone-100 pt-8">
        <h2 className="text-lg font-bold text-stone-900">
          Vergelijkbare verhuurders in <span className="text-rose-500">{city}</span>
        </h2>

        {landlords.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">
            Geen andere verhuurders gevonden in {city}.
          </p>
        ) : (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
            {landlords.map(({ profile, listingCount, responseRate }) => {
              const initial = (profile.name ?? profile.email ?? "?").slice(0, 1).toUpperCase();
              const activeStatus = getActiveStatus(profile.last_active_at);
              const rateBadge = responseRate != null ? getResponseRateBadge(responseRate) : null;

              return (
                <div
                  key={profile.id}
                  className="min-w-[220px] flex flex-col rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition hover:shadow-md sm:min-w-0"
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-base font-bold text-stone-500">{initial}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {profile.name ?? "Welkthuis gebruiker"}
                      </p>
                      {profile.verification_badge && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {profile.verification_badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      {listingCount} advertentie{listingCount !== 1 ? "s" : ""}
                    </span>

                    {rateBadge && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${rateBadge.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${rateBadge.dot}`} />
                        {rateBadge.label} respons
                      </span>
                    )}

                    {activeStatus && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${activeStatus.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${activeStatus.dot}`} />
                        {activeStatus.label}
                      </span>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(profile.id)}
                    className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.98]"
                  >
                    Bekijk profiel
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
