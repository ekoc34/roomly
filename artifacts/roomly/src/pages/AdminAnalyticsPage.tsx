/**
 * Admin Revenue Analytics Dashboard — /admin/analytics
 *
 * Accessible only to users with role = 'admin'.
 * Uses the same auth guard pattern as AdminDashboardPage.tsx.
 * All metrics are derived from real platform data — no invented numbers.
 */

import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, CreditCard, Users, MessageSquare,
  MapPin, Activity, TrendingUp, Eye, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────

type TimeFilter = "today" | "7d" | "30d";

type BoostLogRow = {
  id: string;
  action: string;
  credits_used: number;
  created_at: string;
  user_id: string | null;
  listing_id: string | null;
  profiles: { name: string | null } | null;
  listings: { title: string | null; location: string | null } | null;
};

type StripePurchase = {
  event_id: string;
  event_type: string;
  created_at: string;
};

type ListingRow = {
  id: string;
  user_id: string;
  boosted_at: string | null;
  location: string;
  created_at: string;
};

type ConvRow = {
  id: string;
  listing_id: string;
  created_at: string;
};

type ViewRow = {
  listing_id: string;
};

type ActivityItem = {
  id: string;
  kind: "boost" | "conversation" | "listing" | "payment";
  label: string;
  sub: string | null;
  ts: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getWindowStart(filter: TimeFilter): Date {
  const now = new Date();
  if (filter === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = filter === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000);
}

function fmtRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u geleden`;
  const days = Math.floor(hrs / 24);
  return `${days}d geleden`;
}

function extractCity(location: string): string {
  return location.split(",")[0].trim();
}

const BOOST_WINDOW_MS = 60 * 60 * 1000;

function fmt1(n: number): string {
  return n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent ?? "bg-stone-100"}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-stone-900">{value}</p>
        <p className="text-xs text-stone-500">{label}</p>
        {sub && <p className="mt-0.5 text-[11px] text-stone-400">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-stone-400">{text}</p>;
}

function ActivityDot({ kind }: { kind: ActivityItem["kind"] }) {
  const styles: Record<ActivityItem["kind"], string> = {
    boost: "bg-amber-400",
    conversation: "bg-blue-400",
    listing: "bg-emerald-400",
    payment: "bg-rose-400",
  };
  return (
    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles[kind]}`} />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");

  // Raw data
  const [boostLogs, setBoostLogs] = useState<BoostLogRow[]>([]);
  const [stripePurchases, setStripePurchases] = useState<StripePurchase[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setRoleLoading(false); return; }
    supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
      setRole(data?.role ?? null);
      setRoleLoading(false);
    });
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user || role !== "admin") {
      toast.error("Je hebt geen toegang tot deze pagina.");
      navigate("/dashboard");
    }
  }, [role, roleLoading, authLoading, user, navigate]);

  // ── Data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "admin" || !supabase) return;

    async function fetchAll() {
      setDataLoading(true);
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

        const [
          { data: bLogs },
          { data: sEvents },
          { data: lRows },
          { data: cRows },
          { data: vRows },
        ] = await Promise.all([
          supabase!
            .from("boost_logs")
            .select("id, action, credits_used, created_at, user_id, listing_id, profiles ( name ), listings ( title, location )")
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase!
            .from("stripe_processed_events")
            .select("event_id, event_type, created_at")
            .eq("event_type", "checkout.session.completed")
            .gte("created_at", thirtyDaysAgo)
            .order("created_at", { ascending: false })
            .limit(500),
          supabase!
            .from("listings")
            .select("id, user_id, boosted_at, location, created_at"),
          supabase!
            .from("conversations")
            .select("id, listing_id, created_at")
            .order("created_at", { ascending: false })
            .limit(2000),
          supabase!
            .from("listing_views")
            .select("listing_id")
            .limit(10000),
        ]);

        setBoostLogs((bLogs as unknown as BoostLogRow[] | null) ?? []);
        setStripePurchases((sEvents as StripePurchase[] | null) ?? []);
        setListings((lRows as ListingRow[] | null) ?? []);
        setConversations((cRows as ConvRow[] | null) ?? []);
        setViews((vRows as ViewRow[] | null) ?? []);
      } catch {
        toast.error("Laden mislukt. Probeer het opnieuw.");
      } finally {
        setDataLoading(false);
      }
    }

    fetchAll();
  }, [role]);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const {
    filteredBoosts,
    filteredStripe,
    filteredConvs,
    activeLandlords,
    topCities,
    repeatBuyerCount,
    avgBoostsPerBuyer,
    payingCount,
    boostedAvgViews,
    nonBoostedAvgViews,
    boostedAvgConvs,
    nonBoostedAvgConvs,
    boostedListingCount,
    nonBoostedListingCount,
    activityFeed,
  } = useMemo(() => {
    const windowStart = getWindowStart(timeFilter);

    const filteredBoosts = boostLogs.filter(
      (b) => new Date(b.created_at) >= windowStart,
    );
    const filteredStripe = stripePurchases.filter(
      (s) => new Date(s.created_at) >= windowStart,
    );
    const filteredConvs = conversations.filter(
      (c) => new Date(c.created_at) >= windowStart,
    );

    // Unique landlords with at least one listing
    const activeLandlords = new Set(listings.map((l) => l.user_id)).size;

    // Top cities by boost count in window
    const cityCounts: Record<string, number> = {};
    for (const b of filteredBoosts) {
      const loc = b.listings?.location;
      if (loc) {
        const city = extractCity(loc);
        if (city) cityCounts[city] = (cityCounts[city] ?? 0) + (b.credits_used ?? 1);
      }
    }
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Repeat buyers
    const buyerBoostCounts: Record<string, number> = {};
    for (const b of filteredBoosts) {
      const uid = b.user_id;
      if (uid) buyerBoostCounts[uid] = (buyerBoostCounts[uid] ?? 0) + 1;
    }
    const allBuyerCounts = Object.values(buyerBoostCounts);
    const repeatBuyerCount = allBuyerCounts.filter((c) => c > 1).length;
    const payingCount = allBuyerCounts.length;
    const totalCreditsUsed = filteredBoosts.reduce((s, b) => s + (b.credits_used ?? 0), 0);
    const avgBoostsPerBuyer = payingCount > 0 ? totalCreditsUsed / payingCount : 0;

    // Boost effectiveness — all-time, global (not time-filtered)
    const now = Date.now();
    const boostedIds = new Set(
      listings
        .filter((l) => l.boosted_at != null && new Date(l.boosted_at).getTime() + BOOST_WINDOW_MS > now)
        .map((l) => l.id),
    );
    // For a broader comparison use "ever boosted" vs "never boosted"
    const everBoostedIds = new Set(
      listings.filter((l) => l.boosted_at != null).map((l) => l.id),
    );
    const boostedListingCount = everBoostedIds.size;
    const nonBoostedListingCount = listings.length - boostedListingCount;

    const viewsByListing: Record<string, number> = {};
    for (const v of views) {
      viewsByListing[v.listing_id] = (viewsByListing[v.listing_id] ?? 0) + 1;
    }
    const convsByListing: Record<string, number> = {};
    for (const c of conversations) {
      convsByListing[c.listing_id] = (convsByListing[c.listing_id] ?? 0) + 1;
    }

    let boostedViewsSum = 0, nonBoostedViewsSum = 0;
    let boostedConvsSum = 0, nonBoostedConvsSum = 0;
    for (const l of listings) {
      const v = viewsByListing[l.id] ?? 0;
      const c = convsByListing[l.id] ?? 0;
      if (everBoostedIds.has(l.id)) {
        boostedViewsSum += v;
        boostedConvsSum += c;
      } else {
        nonBoostedViewsSum += v;
        nonBoostedConvsSum += c;
      }
    }
    const boostedAvgViews = boostedListingCount > 0 ? boostedViewsSum / boostedListingCount : 0;
    const nonBoostedAvgViews = nonBoostedListingCount > 0 ? nonBoostedViewsSum / nonBoostedListingCount : 0;
    const boostedAvgConvs = boostedListingCount > 0 ? boostedConvsSum / boostedListingCount : 0;
    const nonBoostedAvgConvs = nonBoostedListingCount > 0 ? nonBoostedConvsSum / nonBoostedListingCount : 0;

    // Activity feed — combine boost, conversations, listings, payments (last 20)
    const feed: ActivityItem[] = [];

    for (const b of boostLogs.slice(0, 100)) {
      const city = b.listings?.location ? extractCity(b.listings.location) : null;
      feed.push({
        id: `boost-${b.id}`,
        kind: "boost",
        label: "Boost geactiveerd",
        sub: city ?? b.listings?.title ?? null,
        ts: b.created_at,
      });
    }
    for (const c of conversations.slice(0, 100)) {
      feed.push({
        id: `conv-${c.id}`,
        kind: "conversation",
        label: "Nieuwe conversatie gestart",
        sub: null,
        ts: c.created_at,
      });
    }
    for (const l of listings.slice(0, 100)) {
      feed.push({
        id: `listing-${l.id}`,
        kind: "listing",
        label: "Nieuwe advertentie geplaatst",
        sub: extractCity(l.location) || null,
        ts: l.created_at,
      });
    }
    for (const s of stripePurchases.slice(0, 100)) {
      feed.push({
        id: `stripe-${s.event_id}`,
        kind: "payment",
        label: "Premium checkout verwerkt",
        sub: null,
        ts: s.created_at,
      });
    }

    const activityFeed = feed
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 25);

    return {
      filteredBoosts,
      filteredStripe,
      filteredConvs,
      activeLandlords,
      topCities,
      repeatBuyerCount,
      avgBoostsPerBuyer,
      payingCount,
      boostedAvgViews,
      nonBoostedAvgViews,
      boostedAvgConvs,
      nonBoostedAvgConvs,
      boostedListingCount,
      nonBoostedListingCount,
      activityFeed,
      boostedIds,
    };
  }, [boostLogs, stripePurchases, listings, conversations, views, timeFilter]);

  // ── Render guard ──────────────────────────────────────────────────────────
  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
      </div>
    );
  }

  if (role !== "admin") return null;

  const filterLabels: Record<TimeFilter, string> = {
    today: "Vandaag",
    "7d": "7 dagen",
    "30d": "30 dagen",
  };

  const totalBoostCredits = filteredBoosts.reduce((s, b) => s + (b.credits_used ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:bg-stone-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-stone-900">Revenue & Analytics</h1>
          <p className="text-xs text-stone-500">Interne platformanalyse · alleen zichtbaar voor admins</p>
        </div>
      </div>

      {/* Time filter */}
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 w-fit">
        {(["today", "7d", "30d"] as TimeFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTimeFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              timeFilter === f
                ? "bg-white shadow-sm text-stone-900"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {dataLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-stone-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Laden…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={<Zap className="h-4 w-4 text-amber-600" />}
              label="Boosts geactiveerd"
              value={totalBoostCredits}
              sub={`${filteredBoosts.length} activaties`}
              accent="bg-amber-50"
            />
            <MetricCard
              icon={<CreditCard className="h-4 w-4 text-rose-600" />}
              label="Stripe betalingen"
              value={filteredStripe.length}
              sub="checkout.session.completed"
              accent="bg-rose-50"
            />
            <MetricCard
              icon={<Users className="h-4 w-4 text-blue-600" />}
              label="Actieve verhuurders"
              value={activeLandlords}
              sub="met ≥1 advertentie"
              accent="bg-blue-50"
            />
            <MetricCard
              icon={<MessageSquare className="h-4 w-4 text-emerald-600" />}
              label="Nieuwe gesprekken"
              value={filteredConvs.length}
              sub={filterLabels[timeFilter]}
              accent="bg-emerald-50"
            />
          </div>

          {/* Top cities + Repeat buyers */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard title="Top steden — boost gebruik">
              {topCities.length === 0 ? (
                <EmptyRow text="Geen boostdata in deze periode." />
              ) : (
                <div className="space-y-2">
                  {topCities.map(([city, count], i) => {
                    const maxCount = topCities[0][1];
                    const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return (
                      <div key={city} className="flex items-center gap-2">
                        <span className="w-4 shrink-0 text-right text-[11px] font-medium text-stone-400">
                          {i + 1}
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="flex flex-1 flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-xs font-medium text-stone-700">
                                <MapPin className="h-3 w-3 text-stone-400" />
                                {city}
                              </span>
                              <span className="text-xs tabular-nums text-stone-500">
                                {count} {count === 1 ? "boost" : "boosts"}
                              </span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-stone-100">
                              <div
                                className="h-1 rounded-full bg-amber-400 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Terugkerende kopers">
              {payingCount === 0 ? (
                <EmptyRow text="Geen boostdata in deze periode." />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-stone-900">{repeatBuyerCount}</span>
                    <span className="text-sm text-stone-500">
                      {repeatBuyerCount === 1 ? "verhuurder kocht" : "verhuurders kochten"} opnieuw
                    </span>
                  </div>
                  <div className="space-y-2 border-t border-stone-100 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Betalende verhuurders</span>
                      <span className="font-medium text-stone-800">{payingCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Gem. boosts per verhuurder</span>
                      <span className="font-medium text-stone-800">{fmt1(avgBoostsPerBuyer)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Repeat buyer rate</span>
                      <span className="font-medium text-stone-800">
                        {payingCount > 0
                          ? `${Math.round((repeatBuyerCount / payingCount) * 100)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  {repeatBuyerCount > 0 && (
                    <p className="text-xs text-stone-400">
                      {repeatBuyerCount} {repeatBuyerCount === 1 ? "verhuurder heeft" : "verhuurders hebben"} meer dan één boost geactiveerd in deze periode.
                    </p>
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Boost effectiveness */}
          <SectionCard title="Boost effectiviteit — gemiddelden per advertentie">
            {listings.length === 0 ? (
              <EmptyRow text="Geen advertentiedata beschikbaar." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                      Boosted · weergaven
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">{fmt1(boostedAvgViews)}</p>
                    <p className="text-[10px] text-stone-400">{boostedListingCount} advertenties</p>
                  </div>
                  <div className="rounded-lg border border-stone-100 bg-stone-50/50 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                      Niet boosted · weergaven
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">{fmt1(nonBoostedAvgViews)}</p>
                    <p className="text-[10px] text-stone-400">{nonBoostedListingCount} advertenties</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                      Boosted · reacties
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">{fmt1(boostedAvgConvs)}</p>
                    <p className="text-[10px] text-stone-400">gem. gesprekken</p>
                  </div>
                  <div className="rounded-lg border border-stone-100 bg-stone-50/50 p-3 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                      Niet boosted · reacties
                    </p>
                    <p className="mt-1 text-2xl font-bold text-stone-900">{fmt1(nonBoostedAvgConvs)}</p>
                    <p className="text-[10px] text-stone-400">gem. gesprekken</p>
                  </div>
                </div>

                {/* Insight line */}
                {boostedListingCount > 0 && nonBoostedListingCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <span>
                      {boostedAvgConvs > nonBoostedAvgConvs
                        ? `Boosted advertenties ontvangen gemiddeld meer gesprekken dan niet-boosted advertenties (${fmt1(boostedAvgConvs)} vs ${fmt1(nonBoostedAvgConvs)}).`
                        : boostedAvgConvs === nonBoostedAvgConvs
                        ? "Boosted en niet-boosted advertenties ontvangen gemiddeld even veel gesprekken."
                        : `Niet-boosted advertenties ontvangen momenteel gemiddeld meer gesprekken — weinig data voor boosted advertenties (${boostedListingCount} listings).`}
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-stone-400">
                  Gebaseerd op alle advertenties die ooit een boost ontvingen vs. nooit geboost.
                  Weergaven en gesprekken zijn platformbreed geteld.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Activity feed */}
          <SectionCard title="Recente activiteit">
            {activityFeed.length === 0 ? (
              <EmptyRow text="Geen recente activiteit gevonden." />
            ) : (
              <div className="divide-y divide-stone-100">
                {activityFeed.map((item) => {
                  const kindLabels: Record<ActivityItem["kind"], string> = {
                    boost: "Boost",
                    conversation: "Gesprek",
                    listing: "Advertentie",
                    payment: "Betaling",
                  };
                  return (
                    <div key={item.id} className="flex items-start gap-3 py-2.5">
                      <ActivityDot kind={item.kind} />
                      <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-stone-700">{item.label}</span>
                          {item.sub && (
                            <span className="ml-1.5 text-xs text-stone-400">· {item.sub}</span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                            {kindLabels[item.kind]}
                          </span>
                          <span className="text-[11px] tabular-nums text-stone-400 whitespace-nowrap">
                            {fmtRelative(item.ts)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <p className="text-center text-[11px] text-stone-400">
            Gegevens worden eenmalig geladen bij paginabezoek. Vernieuw de pagina voor de meest recente data.
          </p>
        </div>
      )}
    </div>
  );
}
