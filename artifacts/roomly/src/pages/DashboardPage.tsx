import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  UserCircle, X, ShieldCheck, CreditCard, Zap, Edit2, Trash2,
  Home, MessageSquare, Clock, TrendingUp, Heart, Search, Star,
  ArrowRight, CheckCircle2, Circle, SendHorizontal, Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import type { Listing, Profile, ApplicationWithDetails } from "@/types/database";

const BANNER_KEY = "roomly_profile_banner_dismissed";

const BOOST_ACTIVE_MS = 60 * 60 * 1000;
function isBoostActive(boostedAt: string | null): boolean {
  if (!boostedAt) return false;
  return new Date(boostedAt) > new Date(Date.now() - BOOST_ACTIVE_MS);
}

type Tab = "zoektocht" | "verhuur";

type MyApplication = {
  id: string;
  listing_id: string;
  applicant_id: string;
  message: string;
  budget: number | null;
  status: string;
  created_at: string;
  landlord_reply: string | null;
  listings: { id: string; title: string } | null;
};

type ConvSummary = { id: string; listing_id: string; tenant_id: string };

type RecentView = {
  listing_id: string;
  viewed_at: string;
  listing: { id: string; title: string; price: number; location: string; images: string[] } | null;
};

type RecommendedListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string[];
  boosted_at: string | null;
  created_at: string;
};

type WeeklyStats = { views: number; reactions: number; boosts: number };

type LastSavedSearch = {
  name: string | null;
  filters: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
    [key: string]: unknown;
  };
};

function buildSearchUrl(search: LastSavedSearch | null, fallbackCity: string | null): string {
  const params = new URLSearchParams();
  if (search?.filters) {
    const f = search.filters;
    if (f.city) params.set("city", String(f.city));
    else if (fallbackCity) params.set("city", fallbackCity);
    if (f.minPrice != null) params.set("minPrice", String(f.minPrice));
    if (f.maxPrice != null) params.set("maxPrice", String(f.maxPrice));
    if (f.type) params.set("type", String(f.type));
  } else if (fallbackCity) {
    params.set("city", fallbackCity);
  }
  const qs = params.toString();
  return qs ? `/kamers?${qs}` : "/kamers";
}

function buildSearchSummary(search: LastSavedSearch | null, fallbackCity: string | null): string {
  const parts: string[] = [];
  const city = search?.filters?.city ?? fallbackCity;
  if (city) parts.push(String(city));
  if (search?.filters?.maxPrice != null) parts.push(`max €${Number(search.filters.maxPrice).toLocaleString("nl-NL")}`);
  if (search?.filters?.minPrice != null && search.filters.maxPrice == null) parts.push(`min €${Number(search.filters.minPrice).toLocaleString("nl-NL")}`);
  const typeMap: Record<string, string> = {
    room_for_rent: "Kamer", roommate_search: "Huisgenoot", short_stay: "Short stay",
  };
  if (search?.filters?.type) parts.push(typeMap[String(search.filters.type)] ?? String(search.filters.type));
  return parts.length > 0 ? parts.join(" · ") : "Bekijk alle woningen";
}

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [tenantConvsCount, setTenantConvsCount] = useState(0);
  const [landlordConvsCount, setLandlordConvsCount] = useState(0);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<ApplicationWithDetails[]>([]);
  const [tenantConversations, setTenantConversations] = useState<ConvSummary[]>([]);
  const [landlordConversations, setLandlordConversations] = useState<ConvSummary[]>([]);
  const [savedSearchesCount, setSavedSearchesCount] = useState(0);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [inlineReply, setInlineReply] = useState<{ appId: string; action: "accepted" | "rejected"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("zoektocht");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTenantId, setConfirmDeleteTenantId] = useState<string | null>(null);
  const [recentApplicationsCount, setRecentApplicationsCount] = useState<number | null>(null);
  const [recentLandlordApplicationsCount, setRecentLandlordApplicationsCount] = useState<number | null>(null);
  const [confirmClearViews, setConfirmClearViews] = useState(false);
  const [clearingViews, setClearingViews] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem(BANNER_KEY) === "1");
  const [, navigate] = useLocation();

  // New state
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [unreadLandlordMsgCount, setUnreadLandlordMsgCount] = useState(0);
  const [recommendedListings, setRecommendedListings] = useState<RecommendedListing[]>([]);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [lastSavedSearch, setLastSavedSearch] = useState<LastSavedSearch | null>(null);

  const listingIdsRef = useRef<string[]>([]);
  useEffect(() => { listingIdsRef.current = myListings.map((l) => l.id); }, [myListings]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }

    async function fetchData() {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const [
        { data: p },
        { data: ls },
        { count: favCount },
        { count: tenantConvCount },
        { count: landlordConvCount },
        { data: myApps },
        { data: tenantConvData },
        { count: savedCount },
        { data: recentViewsData, error: recentViewsError },
        { data: lastSearchData },
      ] = await Promise.all([
        supabase!.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase!.from("listings").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase!.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase!.from("conversations").select("*", { count: "exact", head: true }).eq("tenant_id", user!.id).not("hidden_by", "cs", `{${user!.id}}`),
        supabase!.from("conversations").select("*", { count: "exact", head: true }).eq("landlord_id", user!.id).not("hidden_by", "cs", `{${user!.id}}`),
        supabase!.from("applications").select("*, listings:listing_id(id, title)").eq("applicant_id", user!.id).eq("hidden_by_tenant", false).order("created_at", { ascending: false }),
        supabase!.from("conversations").select("id, listing_id, tenant_id").eq("tenant_id", user!.id),
        supabase!.from("saved_searches").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase!.from("listing_views").select("listing_id, viewed_at, listing:listings(id, title, price, location, images)").eq("user_id", user!.id).order("viewed_at", { ascending: false }).limit(5),
        supabase!.from("saved_searches").select("name, filters").eq("user_id", user!.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (recentViewsError) console.error("[listing_views] select failed:", recentViewsError.message);
      setProfile(p as Profile | null);
      setFavoritesCount(favCount ?? 0);
      setTenantConvsCount(tenantConvCount ?? 0);
      setLandlordConvsCount(landlordConvCount ?? 0);
      setSavedSearchesCount(savedCount ?? 0);

      const views = (recentViewsData as RecentView[] | null) ?? [];
      setRecentViews(views);
      setMyApplications((myApps as MyApplication[] | null) ?? []);
      setTenantConversations((tenantConvData as ConvSummary[] | null) ?? []);

      const lsData = lastSearchData as LastSavedSearch | null;
      setLastSavedSearch(lsData);

      // Build personalized recommendations: prefer city from last saved search or most recently viewed listing
      const cityFromSearch = lsData?.filters?.city;
      const cityFromViews = views[0]?.listing?.location?.split(",")[0]?.trim() ?? null;
      const preferredCity = cityFromSearch ?? cityFromViews;

      let recQuery = supabase!.from("listings")
        .select("id, title, price, location, images, boosted_at, created_at")
        .order("created_at", { ascending: false })
        .limit(4);
      if (preferredCity) {
        recQuery = supabase!.from("listings")
          .select("id, title, price, location, images, boosted_at, created_at")
          .ilike("location", `%${preferredCity}%`)
          .order("created_at", { ascending: false })
          .limit(4);
      }
      const { data: recListings } = await recQuery;
      const recs = (recListings as RecommendedListing[] | null) ?? [];
      // Fallback: if city filter returned nothing, fetch newest globally
      if (recs.length === 0 && preferredCity) {
        const { data: fallbackRecs } = await supabase!.from("listings")
          .select("id, title, price, location, images, boosted_at, created_at")
          .order("created_at", { ascending: false }).limit(4);
        setRecommendedListings((fallbackRecs as RecommendedListing[] | null) ?? []);
      } else {
        setRecommendedListings(recs);
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: recentCount, error: recentErr } = await supabase!
        .from("applications").select("id", { count: "exact", head: true })
        .eq("applicant_id", user!.id).eq("hidden_by_tenant", false)
        .gte("created_at", thirtyDaysAgo.toISOString());
      if (!recentErr) setRecentApplicationsCount(recentCount ?? 0);

      const listings = (ls as Listing[] | null) ?? [];
      setMyListings(listings);

      if (listings.length > 0) {
        const listingIds = listings.map((l) => l.id);
        const [{ data: apps }, { data: landlordConvData }] = await Promise.all([
          supabase!
            .from("applications")
            .select("*, profiles:applicant_id(name, email, avatar_url, phone_verified, email_auto_verified, student_verified, verification_badge), listings:listing_id(title)")
            .in("listing_id", listingIds).eq("hidden_by_landlord", false)
            .order("created_at", { ascending: false }),
          supabase!.from("conversations").select("id, listing_id, tenant_id").in("listing_id", listingIds),
        ]);
        setReceivedApplications((apps as ApplicationWithDetails[] | null) ?? []);
        setLandlordConversations((landlordConvData as ConvSummary[] | null) ?? []);

        const thirtyDaysAgoLandlord = new Date();
        thirtyDaysAgoLandlord.setDate(thirtyDaysAgoLandlord.getDate() - 30);
        const { count: recentLandlordCount } = await supabase!
          .from("applications").select("id", { count: "exact", head: true })
          .in("listing_id", listingIds).eq("status", "pending").eq("hidden_by_landlord", false)
          .gte("created_at", thirtyDaysAgoLandlord.toISOString());
        setRecentLandlordApplicationsCount(recentLandlordCount ?? 0);

        // Weekly stats
        const [{ count: weekViews }, { count: weekReactions }, { count: weekBoosts }] = await Promise.all([
          supabase!.from("listing_views").select("*", { count: "exact", head: true })
            .in("listing_id", listingIds).gte("viewed_at", weekStart.toISOString()),
          supabase!.from("applications").select("*", { count: "exact", head: true })
            .in("listing_id", listingIds).gte("created_at", weekStart.toISOString()),
          supabase!.from("boost_logs").select("*", { count: "exact", head: true })
            .eq("user_id", user!.id).gte("created_at", weekStart.toISOString()),
        ]);
        setWeeklyStats({ views: weekViews ?? 0, reactions: weekReactions ?? 0, boosts: weekBoosts ?? 0 });

        // Unread messages for landlord
        const convIds = (landlordConvData as ConvSummary[] | null ?? []).map((c) => c.id);
        if (convIds.length > 0) {
          const { count: unreadCount } = await supabase!
            .from("messages").select("*", { count: "exact", head: true })
            .in("conversation_id", convIds).neq("sender_id", user!.id).is("read_at", null);
          setUnreadLandlordMsgCount(unreadCount ?? 0);
        }
      }

      setLoading(false);
    }
    fetchData();
  }, [user, authLoading]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`landlord-applications-rt-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applications" }, (payload) => {
        const row = payload.new as {
          id: string; listing_id: string; applicant_id: string;
          message: string; budget: number | null; status: string;
          hidden_by_landlord: boolean; contact_revealed: boolean; created_at: string;
          landlord_reply?: string | null;
        };
        if (!listingIdsRef.current.includes(row.listing_id)) return;
        if (row.hidden_by_landlord) return;
        const newApp: ApplicationWithDetails = {
          ...row, landlord_reply: row.landlord_reply ?? null,
          status: row.status as ApplicationWithDetails["status"], profiles: null, listings: null,
        };
        setReceivedApplications((prev) => {
          if (prev.some((a) => a.id === row.id)) return prev;
          return [newApp, ...prev];
        });
        setRecentLandlordApplicationsCount((prev) => (prev !== null ? prev + 1 : 1));
        if (supabase) {
          Promise.all([
            supabase.from("profiles").select("name, email, avatar_url, phone_verified, email_auto_verified, student_verified, verification_badge").eq("id", row.applicant_id).maybeSingle(),
            supabase.from("listings").select("title").eq("id", row.listing_id).maybeSingle(),
          ]).then(([{ data: profile }, { data: listing }]) => {
            setReceivedApplications((prev) =>
              prev.map((a) => a.id === row.id
                ? { ...a, profiles: profile as ApplicationWithDetails["profiles"] ?? null, listings: listing ? { title: listing.title } : null }
                : a
              )
            );
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Real-time updates for the tenant's own applications (Woningzoekende dashboard)
  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`tenant-applications-rt-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "applications",
          filter: `applicant_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as MyApplication;
          setMyApplications((prev) =>
            prev.map((a) =>
              a.id === updated.id
                ? {
                    ...a,
                    status: updated.status,
                    landlord_reply: updated.landlord_reply ?? null,
                  }
                : a
            )
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function handleApplicationStatus(appId: string, status: "accepted" | "rejected", replyText?: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from("applications").update({ status, landlord_reply: replyText?.trim() || null }).eq("id", appId);
    if (error) { toast.error("Er ging iets mis, probeer opnieuw."); return; }

    const app = receivedApplications.find((a) => a.id === appId);
    let convId: string | null = null;

    if (app && (status === "accepted" || (status === "rejected" && replyText?.trim()))) {
      const { data: upsertedId, error: convError } = await supabase.rpc("upsert_conversation", {
        p_listing_id: app.listing_id, p_tenant_id: app.applicant_id, p_landlord_id: user.id,
      });
      if (convError) {
        toast.error("Gesprek aanmaken mislukt.");
        return;
      }
      if (upsertedId) {
        convId = upsertedId as string;
        setLandlordConversations((prev) => {
          if (prev.find((c) => c.id === convId)) return prev;
          return [...prev, { id: convId!, listing_id: app.listing_id, tenant_id: app.applicant_id }];
        });
      }
      if (replyText?.trim() && convId) {
        await supabase.from("messages").insert({ conversation_id: convId, sender_id: user.id, body: replyText.trim() });
      }
    }

    if (app) {
      const listingTitle = app.listings?.title ?? "een woning";
      const replySnippet = replyText?.trim() ? `\n\nBericht van verhuurder:\n"${replyText.trim()}"` : "";
      const { data: applicantPrefs } = await supabase.from("profiles").select("notify_application_update").eq("id", app.applicant_id).maybeSingle();
      if (applicantPrefs?.notify_application_update !== false) {
        await supabase.from("notifications").insert({
          user_id: app.applicant_id,
          type: status === "accepted" ? "application_accepted" : "application_rejected",
          title: status === "accepted" ? "Aanvraag geaccepteerd!" : "Aanvraag afgewezen",
          body: status === "accepted"
            ? `Je aanvraag voor "${listingTitle}" is geaccepteerd. Je kunt nu het gesprek bekijken.${replySnippet}`
            : `Je aanvraag voor "${listingTitle}" is helaas niet doorgegaan.${replySnippet}`,
          related_id: convId ?? null, read: false,
        });
      }
    }

    setInlineReply(null);
    setReceivedApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
    toast.success(status === "accepted" ? "Aanvraag geaccepteerd. Er is een gesprek aangemaakt." : "Aanvraag afgewezen.");
  }

  async function handleDeleteTenantApplication(appId: string) {
    if (!supabase || !user) return;
    setConfirmDeleteTenantId(null);
    setMyApplications((prev) => prev.filter((a) => a.id !== appId));
    const { error } = await supabase.from("applications").update({ hidden_by_tenant: true }).eq("id", appId);
    if (error) toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    else toast.success("Aanvraag verwijderd.");
  }

  async function handleDeleteApplication(appId: string) {
    if (!supabase || !user) return;
    setConfirmDeleteId(null);
    setReceivedApplications((prev) => prev.filter((a) => a.id !== appId));
    const { error } = await supabase.from("applications").update({ hidden_by_landlord: true }).eq("id", appId);
    if (error) toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    else toast.success("Aanvraag verwijderd.");
  }

  async function handleBoostListing(listingId: string) {
    if (!supabase || !user || boostingId) return;
    if ((profile?.boost_credits ?? 0) <= 0) {
      toast.error("Geen boost credits beschikbaar. Koop meer credits.");
      return;
    }
    setBoostingId(listingId);
    const { error } = await supabase.rpc("boost_listing", { p_listing_id: listingId });
    setBoostingId(null);
    if (error) { toast.error("Booster mislukt. Probeer het opnieuw."); return; }
    toast.success("Advertentie uitgelicht! 🚀");
    setMyListings((prev) => prev.map((l) => l.id === listingId ? { ...l, boosted_at: new Date().toISOString() } : l));
    setProfile((p) => p ? { ...p, boost_credits: Math.max(0, (p.boost_credits ?? 0) - 1) } : p);
  }

  async function handleDeleteListingFromDashboard(listingId: string) {
    if (!supabase || !user) return;
    setDeletingListingId(null);
    const { error } = await supabase.from("listings").delete().eq("id", listingId).eq("user_id", user.id);
    if (error) { toast.error("Verwijderen mislukt. Probeer het opnieuw."); return; }
    toast.success("Advertentie verwijderd.");
    setMyListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je dashboard te bekijken</h1>
        <Link href="/inloggen?next=/dashboard" data-testid="dashboard-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  const initial = (profile?.name ?? profile?.email ?? user?.email ?? "?").slice(0, 1).toUpperCase();
  const pendingCount = receivedApplications.filter((a) => a.status === "pending").length;

  const VERHUUR_TYPES = ["verhuurder", "huisgenoot_zoeker"];
  const effectiveTab: Tab = !loading && profile?.user_type
    ? (VERHUUR_TYPES.includes(profile.user_type) ? "verhuur" : "zoektocht")
    : activeTab;
  const showTabBar = !loading && !profile?.user_type;

  const statusMap = {
    pending: { label: "In behandeling", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    accepted: { label: "Geaccepteerd", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Afgewezen", cls: "bg-stone-100 text-stone-500 border-stone-200" },
  };

  // ── Profile completion helper ──────────────────────────────────────────────
  const profileFields: { key: keyof Profile; pct: number; label: string; missing: string }[] = [
    { key: "name",       pct: 20, label: "naam",         missing: "Voeg je naam toe" },
    { key: "email",      pct: 20, label: "e-mail",       missing: "Voeg je e-mailadres toe" },
    { key: "phone",      pct: 20, label: "telefoon",     missing: "Voeg je telefoonnummer toe" },
    { key: "user_type",  pct: 20, label: "woonsituatie", missing: "Kies je woonsituatie" },
    { key: "bio",        pct: 10, label: "bio",          missing: "Schrijf een korte bio" },
    { key: "avatar_url", pct: 10, label: "profielfoto",  missing: "Voeg een profielfoto toe" },
  ];

  const profilePct = !loading && profile
    ? profileFields.reduce((sum, f) => sum + (profile[f.key] ? f.pct : 0), 0)
    : 0;
  const missingProfileFields = !loading && profile
    ? profileFields.filter((f) => !profile[f.key])
    : [];

  return (
    <>
      <Helmet>
        <title>Dashboard — Welkthuis.nl</title>
      </Helmet>
      <ApplicantProfilePanel
        profileId={selectedApplicantId}
        onClose={() => { setSelectedApplicantId(null); setSelectedApplicationId(null); }}
        mode="applicant"
        viewerLandlordId={user?.id}
        applicationId={selectedApplicationId ?? undefined}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 shadow-sm">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-xl font-bold text-stone-500">{initial}</span>}
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">
                {loading ? "Laden…" : (profile?.name ?? profile?.email ?? user?.email ?? "Gebruiker")}
              </h1>
              <p className="text-sm text-stone-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profiel" className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" data-testid="dashboard-edit-profile">
              Profiel bewerken
            </Link>
          </div>
        </div>

        {/* ── Profile completion banner ─────────────────────────────────────── */}
        {!loading && !profile?.user_type && !bannerDismissed && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:items-center">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <UserCircle className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-sm leading-relaxed text-amber-900">
                Maak je profiel compleet door je woonsituatie te kiezen. Zo kunnen we je beter helpen.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => navigate("/profiel")} className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-95">
                Profiel aanvullen
              </button>
              <button type="button" aria-label="Sluiten"
                onClick={() => { localStorage.setItem(BANNER_KEY, "1"); setBannerDismissed(true); }}
                className="rounded-lg p-1 text-amber-500 transition hover:bg-amber-100 hover:text-amber-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showTabBar && (
          <div className="mt-8 flex gap-2 border-b border-stone-200">
            <button onClick={() => setActiveTab("zoektocht")} className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "zoektocht" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              <Search className="h-4 w-4" />
              Mijn zoektocht
            </button>
            <button onClick={() => setActiveTab("verhuur")} className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "verhuur" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              <Home className="h-4 w-4" />
              Mijn verhuur
              {!loading && pendingCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{pendingCount}</span>
              )}
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            VERHUURDER / HUISGENOOT ZOEKER — Operations Cockpit
            ════════════════════════════════════════════════════════════════════ */}
        {effectiveTab === "verhuur" && (
          <div className="mt-6 space-y-8">

            {/* 1. Full-width CTA */}
            <Link
              href="/kamers/nieuw"
              data-testid="dashboard-new-listing"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.99]"
            >
              <span className="text-xl leading-none">+</span>
              Advertentie plaatsen
            </Link>

            {/* 2. Stats — 4 columns */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                {
                  label: "Actieve advertenties",
                  value: loading ? "…" : myListings.length,
                  href: "#listings",
                  icon: <Home className="h-5 w-5 text-rose-400" />,
                },
                {
                  label: "Openstaande aanvragen",
                  value: loading ? "…" : pendingCount,
                  href: "#aanvragen",
                  icon: <Star className="h-5 w-5 text-amber-400" />,
                  sub: !loading && recentLandlordApplicationsCount ? `+${recentLandlordApplicationsCount} in 30 dagen` : null,
                },
                {
                  label: "Nieuwe berichten",
                  value: loading ? "…" : unreadLandlordMsgCount,
                  href: "/berichten",
                  icon: <MessageSquare className="h-5 w-5 text-blue-400" />,
                },
                {
                  label: "Mijn reactietijd",
                  value: loading ? "…"
                    : profile?.avg_response_time_hours != null
                      ? (profile.avg_response_time_hours < 1 ? "< 1 uur" : `${Math.round(profile.avg_response_time_hours)} uur`)
                      : "—",
                  href: "#",
                  icon: <Clock className="h-5 w-5 text-emerald-400" />,
                  isText: true,
                },
              ].map((stat) => (
                <a key={stat.label} href={stat.href}
                  className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-500 truncate">{stat.label}</p>
                    <p className={`font-black text-stone-900 ${stat.isText ? "text-lg" : "text-2xl"}`}>{stat.value}</p>
                    {stat.sub && <p className="mt-0.5 text-xs text-stone-400">{stat.sub}</p>}
                  </div>
                </a>
              ))}
            </div>

            {/* 3. Quick performance — this week */}
            <div className="flex items-center gap-4 rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <TrendingUp className="h-4 w-4 text-rose-500" />
              </span>
              <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                <span className="font-semibold text-stone-900">Deze week:</span>
                {loading || !weeklyStats ? (
                  <span className="h-4 w-32 animate-pulse rounded-full bg-stone-200" />
                ) : (
                  <>
                    <span><span className="font-bold text-stone-900">+{weeklyStats.views}</span> weergaven</span>
                    <span><span className="font-bold text-stone-900">+{weeklyStats.reactions}</span> reacties</span>
                    <span><span className="font-bold text-stone-900">+{weeklyStats.boosts}</span> boosts gebruikt</span>
                  </>
                )}
              </div>
            </div>

            {/* 4. Mijn Advertenties */}
            <div id="listings">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900">Mijn advertenties</h2>
                <Link href="/kamers/nieuw" className="text-sm font-medium text-rose-600 hover:underline">+ Nieuwe advertentie</Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-stone-200" />)}
                </div>
              ) : myListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                    <Home className="h-6 w-6 text-rose-400" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-stone-800">Nog geen advertenties</h3>
                  <p className="mt-2 max-w-sm text-sm text-stone-500">Plaats je eerste advertentie en bereik duizenden huurders.</p>
                  <Link href="/kamers/nieuw" className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">
                    Advertentie plaatsen
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map((l) => {
                    const boosted = isBoostActive(l.boosted_at ?? null);
                    const appCount = receivedApplications.filter((a) => a.listing_id === l.id).length;
                    const img = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
                    return (
                      <div key={l.id} className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                        {/* Delete confirm overlay */}
                        {deletingListingId === l.id && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm">
                            <p className="text-sm font-medium text-stone-800">Advertentie "{l.title}" verwijderen?</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleDeleteListingFromDashboard(l.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">
                                Ja, verwijderen
                              </button>
                              <button type="button" onClick={() => setDeletingListingId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">
                                Annuleren
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Thumbnail */}
                        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
                          {img
                            ? <img src={img} alt={l.title} className="h-full w-full object-cover" />
                            : <div className="flex h-full w-full items-center justify-center"><Home className="h-5 w-5 text-stone-300" /></div>}
                        </div>
                        {/* Info */}
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-stone-900 truncate">{l.title}</p>
                            {boosted && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <Zap className="h-3 w-3" /> Uitgelicht
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 truncate">{l.location} · €{Number(l.price).toLocaleString("nl-NL")}/mnd</p>
                          <p className="text-xs text-stone-400">{appCount} {appCount === 1 ? "reactie" : "reacties"}</p>
                        </div>
                        {/* Quick actions */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Link
                            href={`/kamers/${l.id}/bewerken`}
                            className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Bewerken
                          </Link>
                          <button
                            type="button"
                            disabled={boostingId === l.id || boosted || (profile?.boost_credits ?? 0) <= 0}
                            onClick={() => handleBoostListing(l.id)}
                            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Zap className="h-3.5 w-3.5" />
                            {boostingId === l.id ? "Bezig…" : boosted ? "Actief" : "Boost nu"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingListingId(l.id)}
                            className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Verwijderen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Aanvragen */}
            <div id="aanvragen">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-bold text-stone-900">Aanvragen</h2>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white">{pendingCount} nieuw</span>
                )}
              </div>
              {loading ? (
                <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}</div>
              ) : receivedApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-50">
                    <MessageSquare className="h-5 w-5 text-stone-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-stone-700">Nog geen aanvragen ontvangen</p>
                  <p className="mt-1 text-xs text-stone-400">Aanvragen van geïnteresseerde huurders verschijnen hier.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedApplications.map((app) => {
                    const name = app.profiles?.name ?? app.profiles?.email ?? "Onbekend";
                    const avatarInitial = name.slice(0, 1).toUpperCase();
                    const badge = statusMap[app.status as keyof typeof statusMap] ?? statusMap.pending;
                    const isApplicantVerified = !!(app.profiles?.phone_verified || app.profiles?.email_auto_verified || app.profiles?.student_verified || app.profiles?.verification_badge);
                    const conv = landlordConversations.find((c) => c.listing_id === app.listing_id && c.tenant_id === app.applicant_id);
                    return (
                      <div key={app.id} className="relative flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 pr-10 shadow-sm sm:flex-row sm:items-start">
                        {confirmDeleteId === app.id && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm">
                            <p className="text-sm font-medium text-stone-800">Weet je zeker dat je deze aanvraag wilt verwijderen?</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleDeleteApplication(app.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">Ja, verwijderen</button>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">Annuleren</button>
                            </div>
                          </div>
                        )}
                        <button type="button" aria-label="Aanvraag verwijderen" onClick={() => setConfirmDeleteId(app.id)}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                          {app.profiles?.avatar_url
                            ? <img src={app.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                            : <span className="text-sm font-bold text-stone-500">{avatarInitial}</span>}
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => { setSelectedApplicantId(app.applicant_id); setSelectedApplicationId(app.id); }} className="text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline">
                              {name}
                            </button>
                            {isApplicantVerified && (
                              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                <ShieldCheck className="h-3 w-3" /> Geverifieerd
                              </span>
                            )}
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {app.listings?.title && (
                            <p className="text-xs text-stone-500"><span className="font-medium text-stone-600">Advertentie:</span> {app.listings.title}</p>
                          )}
                          <p className="text-sm text-stone-600 line-clamp-2">{app.message}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                            {app.budget != null && <span className="font-medium text-stone-600">Budget: €{Number(app.budget).toFixed(0)}</span>}
                            <span>{new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {app.status === "accepted" && conv && (
                            <Link href={`/berichten/${conv.id}`} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600">Gesprek →</Link>
                          )}
                          {app.status === "pending" && inlineReply?.appId !== app.id && (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setInlineReply({ appId: app.id, action: "accepted", text: "" })} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-95">Accepteren</button>
                              <button type="button" onClick={() => setInlineReply({ appId: app.id, action: "rejected", text: "" })} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 active:scale-95">Afwijzen</button>
                            </div>
                          )}
                          {app.status === "pending" && inlineReply?.appId === app.id && (
                            <div className="w-full min-w-[220px] rounded-2xl border border-stone-200 bg-stone-50 p-3 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Optioneel: stuur een bericht</p>
                              <textarea rows={3} maxLength={300} placeholder="Schrijf een bericht..."
                                value={inlineReply.text}
                                onChange={(e) => setInlineReply((r) => r ? { ...r, text: e.target.value } : r)}
                                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleApplicationStatus(app.id, inlineReply.action, inlineReply.text)}
                                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white transition active:scale-95 ${inlineReply.action === "accepted" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-stone-500 hover:bg-stone-600"}`}
                                >
                                  {inlineReply.action === "accepted" ? (inlineReply.text.trim() ? "Accepteren en versturen" : "Accepteren") : (inlineReply.text.trim() ? "Afwijzen en versturen" : "Afwijzen")}
                                </button>
                                <button type="button" onClick={() => setInlineReply(null)} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100">Annuleren</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Boost & Promotie */}
            <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <Zap className="h-5 w-5 text-amber-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-stone-900">Boost Credits</p>
                  <p className="text-2xl font-black text-stone-900">
                    {loading ? "…" : (profile?.boost_credits ?? 0)}
                    <span className="ml-1.5 text-sm font-medium text-stone-500">beschikbaar</span>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">Gebruik credits om je advertentie bovenaan te tonen.</p>
                </div>
              </div>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95 shrink-0">
                <CreditCard className="h-4 w-4" />
                Meer credits kopen
              </Link>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            WONINGZOEKENDE — Discovery Hub
            ════════════════════════════════════════════════════════════════════ */}
        {effectiveTab === "zoektocht" && (() => {
          // Derive city for search continuity
          const cityFromSearch = lastSavedSearch?.filters?.city as string | undefined;
          const cityFromViews = recentViews[0]?.listing?.location?.split(",")[0]?.trim() ?? null;
          const hasSearchContext = !!(cityFromSearch ?? cityFromViews ?? lastSavedSearch);
          const searchUrl = buildSearchUrl(lastSavedSearch, cityFromViews);
          const searchSummary = buildSearchSummary(lastSavedSearch, cityFromViews);

          // Motivational nudge: pick the most impactful missing field
          const nudgeMap: Partial<Record<keyof Profile, string>> = {
            avatar_url: "Profielen met een foto krijgen 3x meer reacties.",
            bio: "Een goede bio verhoogt je kansen aanzienlijk.",
            phone: "Verhuurders nemen sneller contact op als je bereikbaar bent.",
            name: "Voeg je naam toe voor een persoonlijker profiel.",
          };
          const motivationalNudge = missingProfileFields.length > 0
            ? nudgeMap[missingProfileFields[0].key] ?? null
            : null;

          return (
            <div className="mt-6 space-y-8">

              {/* TASK 1 — Search Continuity */}
              {!loading && (hasSearchContext || recentViews.length > 0) && (
                <Link
                  href={searchUrl}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-rose-50/30 px-5 py-4 shadow-sm transition hover:border-rose-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                      <Search className="h-5 w-5 text-rose-500" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-400">Ga verder met je zoekopdracht</p>
                      <p className="mt-0.5 text-sm font-bold text-stone-900">{searchSummary}</p>
                      {lastSavedSearch?.name && (
                        <p className="mt-0.5 text-xs text-stone-400">Opgeslagen als: {lastSavedSearch.name}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-rose-400 transition group-hover:translate-x-1" />
                </Link>
              )}

              {/* TASK 4 — Enhanced Profile Completion Card */}
              {!loading && profile && (
                <div className={`rounded-2xl border p-5 shadow-sm ${profilePct === 100 ? "border-emerald-200 bg-emerald-50/60" : "border-stone-200/80 bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${profilePct === 100 ? "bg-emerald-100" : "bg-rose-50"}`}>
                        <UserCircle className={`h-5 w-5 ${profilePct === 100 ? "text-emerald-600" : "text-rose-400"}`} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-stone-900">Profiel voltooiing</p>
                        {profilePct < 100 && motivationalNudge && (
                          <p className="mt-0.5 text-xs text-rose-500 font-medium">{motivationalNudge}</p>
                        )}
                      </div>
                    </div>
                    {profilePct === 100 ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <ShieldCheck className="h-4 w-4" /> Compleet!
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-stone-500">
                        <span className="font-bold text-stone-800">{profilePct}%</span> compleet
                      </span>
                    )}
                  </div>

                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${profilePct === 100 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${profilePct}%` }}
                    />
                  </div>

                  {profilePct < 100 && missingProfileFields.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      {missingProfileFields.map((f) => (
                        <Link
                          key={f.key}
                          href="/profiel"
                          className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-rose-50"
                        >
                          <span className="flex items-center gap-2 text-xs text-stone-500 group-hover:text-rose-700">
                            <Circle className="h-3 w-3 shrink-0 text-stone-300 group-hover:text-rose-300" />
                            {f.missing}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-rose-500 group-hover:text-rose-700">
                            Toevoegen →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {profilePct < 100 && (
                    <Link href="/profiel" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95">
                      Profiel verbeteren →
                    </Link>
                  )}
                </div>
              )}

              {/* Stats — 3 columns */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    label: "Favorieten",
                    value: loading ? "…" : favoritesCount,
                    href: "/favorieten",
                    icon: <Heart className="h-5 w-5 text-rose-400" />,
                  },
                  {
                    label: "Verzonden reacties",
                    value: loading ? "…" : myApplications.length,
                    href: "#aanvragen",
                    icon: <MessageSquare className="h-5 w-5 text-emerald-400" />,
                    sub: !loading && recentApplicationsCount ? `+${recentApplicationsCount} in 30 dagen` : null,
                  },
                  {
                    label: "Opgeslagen zoekopdrachten",
                    value: loading ? "…" : savedSearchesCount,
                    href: "/opgeslagen-zoekopdrachten",
                    icon: <Search className="h-5 w-5 text-amber-400" />,
                  },
                ].map((stat) => (
                  <a key={stat.label} href={stat.href}
                    className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                    <div>
                      <p className="text-xs font-medium text-stone-500">{stat.label}</p>
                      <p className="text-2xl font-black text-stone-900">{stat.value}</p>
                      {stat.sub && <p className="mt-0.5 text-xs text-stone-400">{stat.sub}</p>}
                    </div>
                  </a>
                ))}
              </div>

              {/* TASK 3 — Mijn aanvragen as Timeline */}
              <div id="aanvragen">
                <h2 className="mb-4 text-lg font-bold text-stone-900">Mijn aanvragen</h2>
                {loading ? (
                  <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}</div>
                ) : myApplications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-50">
                      <SendHorizontal className="h-5 w-5 text-stone-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-stone-700">Nog geen reacties geplaatst</p>
                    <p className="mt-1 text-xs text-stone-400">Reageer op woningen om je voortgang hier te zien.</p>
                    <Link href="/kamers" className="mt-4 text-xs font-semibold text-rose-600 hover:underline">Woningen bekijken →</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myApplications.map((app) => {
                      const conv = tenantConversations.find((c) => c.listing_id === app.listing_id);
                      const hasReply = app.status === "accepted" || app.status === "rejected";
                      const hasBeenSeen = hasReply || !!app.landlord_reply;

                      type TimelineStep = {
                        icon: React.ReactNode;
                        label: string;
                        sub?: string;
                        done: boolean;
                        active: boolean;
                      };

                      const steps: TimelineStep[] = [
                        {
                          icon: <SendHorizontal className="h-3.5 w-3.5" />,
                          label: "Aanvraag verzonden",
                          sub: new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long" }),
                          done: true,
                          active: false,
                        },
                        {
                          icon: <Eye className="h-3.5 w-3.5" />,
                          label: "Bekeken door verhuurder",
                          sub: hasBeenSeen ? undefined : "In afwachting",
                          done: hasBeenSeen,
                          active: !hasBeenSeen && app.status === "pending",
                        },
                        {
                          icon: hasReply
                            ? (app.status === "accepted" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />)
                            : <MessageSquare className="h-3.5 w-3.5" />,
                          label: "Reactie ontvangen",
                          sub: app.status === "accepted" ? "Geaccepteerd" : app.status === "rejected" ? "Afgewezen" : undefined,
                          done: hasReply,
                          active: false,
                        },
                      ];

                      return (
                        <div key={app.id} className="relative rounded-2xl border border-stone-200/80 bg-white p-5 pr-10 shadow-sm">
                          {/* Delete confirm overlay */}
                          {confirmDeleteTenantId === app.id && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm">
                              <p className="text-sm font-medium text-stone-800">Weet je zeker dat je deze aanvraag wilt verwijderen?</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleDeleteTenantApplication(app.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">Ja, verwijderen</button>
                                <button type="button" onClick={() => setConfirmDeleteTenantId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">Annuleren</button>
                              </div>
                            </div>
                          )}
                          <button type="button" aria-label="Aanvraag verwijderen" onClick={() => setConfirmDeleteTenantId(app.id)}
                            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          {/* Header */}
                          <div className="mb-4 flex flex-wrap items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-stone-900 truncate">{app.listings?.title ?? "Woning"}</p>
                              {app.budget != null && (
                                <p className="text-xs text-stone-400">Budget: €{Number(app.budget).toFixed(0)}</p>
                              )}
                            </div>
                            {app.listings?.id && (
                              <Link href={`/kamers/${app.listings.id}`} className="shrink-0 text-xs font-medium text-rose-500 hover:underline">
                                Bekijk woning →
                              </Link>
                            )}
                          </div>

                          {/* Timeline steps */}
                          <div className="flex items-start gap-0">
                            {steps.map((step, idx) => (
                              <div key={step.label} className="flex flex-1 flex-col items-center">
                                {/* Connector + dot row */}
                                <div className="flex w-full items-center">
                                  {/* Left connector line */}
                                  <div className={`h-0.5 flex-1 ${idx === 0 ? "opacity-0" : step.done ? "bg-emerald-400" : "bg-stone-200"}`} />
                                  {/* Icon circle */}
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                    step.done
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-600"
                                      : step.active
                                        ? "border-amber-400 bg-amber-50 text-amber-600 animate-pulse"
                                        : "border-stone-200 bg-stone-50 text-stone-300"
                                  }`}>
                                    {step.icon}
                                  </div>
                                  {/* Right connector line */}
                                  <div className={`h-0.5 flex-1 ${idx === steps.length - 1 ? "opacity-0" : step.done && steps[idx + 1]?.done ? "bg-emerald-400" : "bg-stone-200"}`} />
                                </div>
                                {/* Label below */}
                                <div className="mt-2 text-center px-1">
                                  <p className={`text-[10px] font-semibold leading-tight ${step.done ? "text-emerald-700" : step.active ? "text-amber-600" : "text-stone-400"}`}>
                                    {step.label}
                                  </p>
                                  {step.sub && (
                                    <p className="mt-0.5 text-[10px] text-stone-400 leading-tight">{step.sub}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Footer: reply + action */}
                          {(app.landlord_reply || (app.status === "accepted" && conv)) && (
                            <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                              {app.landlord_reply && (
                                <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Bericht van verhuurder</p>
                                  <p className="mt-0.5 text-xs text-stone-700">{app.landlord_reply}</p>
                                </div>
                              )}
                              {app.status === "accepted" && conv && (
                                <Link href={`/berichten/${conv.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600">
                                  <MessageSquare className="h-3.5 w-3.5" /> Ga naar gesprek
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent bekeken */}
              <div>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-stone-900">Recent bekeken</h2>
                  {!loading && recentViews.length > 0 && !confirmClearViews && (
                    <button type="button" onClick={() => setConfirmClearViews(true)} className="text-xs font-medium text-stone-400 transition hover:text-rose-500">
                      Alles wissen
                    </button>
                  )}
                  {confirmClearViews && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
                      <p className="text-xs font-medium text-rose-800">Geschiedenis wissen?</p>
                      <button type="button" disabled={clearingViews}
                        onClick={async () => {
                          if (!supabase || !user) return;
                          setClearingViews(true);
                          const { error } = await supabase.from("listing_views").delete().eq("user_id", user.id);
                          setClearingViews(false);
                          if (error) toast.error("Wissen mislukt. Probeer het opnieuw.");
                          else { setRecentViews([]); setConfirmClearViews(false); toast.success("Geschiedenis gewist."); }
                        }}
                        className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
                      >
                        {clearingViews ? "Bezig…" : "Ja, wissen"}
                      </button>
                      <button type="button" onClick={() => setConfirmClearViews(false)} className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95">Annuleren</button>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => <div key={n} className="animate-pulse rounded-2xl bg-stone-200 h-36" />)}
                  </div>
                ) : recentViews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
                    <p className="mt-3 text-sm font-medium text-stone-700">Je hebt nog geen woningen bekeken.</p>
                    <Link href="/kamers" className="mt-3 text-xs font-semibold text-rose-600 hover:underline">Bekijk woningen →</Link>
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    {recentViews.map((v) => {
                      const l = v.listing;
                      if (!l) return null;
                      const thumb = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
                      return (
                        <Link key={v.listing_id} href={`/kamers/${l.id}`}
                          className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                            {thumb
                              ? <img src={thumb} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                              : <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-stone-300" /></div>}
                          </div>
                          <div className="flex flex-1 flex-col gap-0.5 p-3">
                            <p className="line-clamp-2 text-xs font-semibold text-stone-900 leading-snug">{l.title}</p>
                            <p className="text-xs text-stone-400 truncate">{l.location}</p>
                            <p className="mt-1 text-xs font-bold text-rose-600">€{Number(l.price).toLocaleString("nl-NL")}/mnd</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TASK 2 — Personalized "Aanbevolen voor jou" */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="text-lg font-bold text-stone-900">Aanbevolen voor jou</h2>
                  {(cityFromSearch ?? cityFromViews) && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                      {cityFromSearch ?? cityFromViews}
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => <div key={n} className="animate-pulse rounded-2xl bg-stone-200 h-48" />)}
                  </div>
                ) : recommendedListings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
                    <p className="text-sm text-stone-500">Geen aanbevelingen beschikbaar.</p>
                    <Link href="/kamers" className="mt-3 text-xs font-semibold text-rose-600 hover:underline">Bekijk alle woningen →</Link>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    {recommendedListings.map((l) => {
                      const thumb = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
                      const boosted = isBoostActive(l.boosted_at);
                      const isNew = !boosted && new Date(l.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                      return (
                        <div key={l.id} className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                            {thumb
                              ? <img src={thumb} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                              : <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-stone-300" /></div>}
                            {boosted && (
                              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                                <Zap className="h-3 w-3" /> Uitgelicht
                              </span>
                            )}
                            {isNew && !boosted && (
                              <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                                Nieuw
                              </span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-0.5 p-3">
                            <p className="line-clamp-2 text-xs font-semibold text-stone-900 leading-snug">{l.title}</p>
                            <p className="text-xs text-stone-400 truncate">{l.location}</p>
                            <p className="mt-1 text-xs font-bold text-rose-600">€{Number(l.price).toLocaleString("nl-NL")}/mnd</p>
                            <Link href={`/kamers/${l.id}`} className="mt-2 flex items-center justify-center rounded-xl border border-stone-200 py-1.5 text-xs font-semibold text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                              Bekijk →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* ── Boost Credits ── */}
        {!loading && profile?.user_type && VERHUUR_TYPES.includes(profile.user_type) && (
          <div className="mt-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <Zap className="h-5 w-5 text-rose-500" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900">Boost Credits</h2>
                <p className="mt-0.5 text-xs text-stone-500">Koop credits om je advertentie uit te lichten en meer huurders te bereiken.</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate("/pricing")}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
            >
              <CreditCard className="h-4 w-4" />
              Boost Credits kopen
            </button>
          </div>
        )}

      </div>
    </>
  );
}
