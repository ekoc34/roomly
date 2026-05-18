import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  UserCircle, X, ShieldCheck, CreditCard, Zap, Edit2, Trash2,
  Home, MessageSquare, Clock, Heart, Search, Star,
  ArrowRight, CheckCircle2, SendHorizontal, Eye, Phone,
  Camera, RefreshCw, FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import { BoostCountdown } from "@/components/listings/BoostBadge";
import { ListingAnalyticsStrip } from "@/components/dashboard/ListingAnalyticsStrip";
import type { Listing, Profile, ApplicationWithDetails } from "@/types/database";
import { isFullyVerified } from "@/lib/verificationUtils";

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
  type: string | null;
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

function buildSearchSummary(search: LastSavedSearch | null, fallbackCity: string | null, fallback: string = "Bekijk alle woningen", typeLabels?: Record<string, string>): string {
  const parts: string[] = [];
  const city = search?.filters?.city ?? fallbackCity;
  if (city) parts.push(String(city));
  if (search?.filters?.maxPrice != null) parts.push(`max €${Number(search.filters.maxPrice).toLocaleString("nl-NL")}`);
  if (search?.filters?.minPrice != null && search.filters.maxPrice == null) parts.push(`min €${Number(search.filters.minPrice).toLocaleString("nl-NL")}`);
  const typeMap: Record<string, string> = typeLabels ?? {
    room_for_rent: "Kamer", roommate_search: "Huisgenoot", short_stay: "Short stay",
  };
  if (search?.filters?.type) parts.push(typeMap[String(search.filters.type)] ?? String(search.filters.type));
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
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
  const [confirmClearApplications, setConfirmClearApplications] = useState(false);
  const [clearingApplications, setClearingApplications] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem(BANNER_KEY) === "1");
  const [, navigate] = useLocation();

  // New state
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [unreadLandlordMsgCount, setUnreadLandlordMsgCount] = useState(0);
  const [recommendedListings, setRecommendedListings] = useState<RecommendedListing[]>([]);
  const [recommendationReason, setRecommendationReason] = useState<{ key: "search" } | { key: "city"; city: string } | null>(null);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [lastSavedSearch, setLastSavedSearch] = useState<LastSavedSearch | null>(null);
  const [listingViewCounts, setListingViewCounts] = useState<Record<string, number>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Task 2 & 5 state
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [quickApplyListingId, setQuickApplyListingId] = useState<string | null>(null);
  const [quickApplyLoading, setQuickApplyLoading] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [applyModalListingId, setApplyModalListingId] = useState<string | null>(null);
  const [applyModalMessage, setApplyModalMessage] = useState("");
  const [applyModalBudget, setApplyModalBudget] = useState("");
  const [applyModalLoading, setApplyModalLoading] = useState(false);


  const recommendationsRef = useRef<HTMLDivElement>(null);
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
        supabase!.from("listing_views").select("listing_id, viewed_at, listing:listings(id, title, price, location, images)").eq("user_id", user!.id).order("viewed_at", { ascending: false }).limit(30),
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

      // --- Personalised recommendations ---
      // Signal 1: most-recent saved search (city + budget + type)
      const searchCity = lsData?.filters?.city as string | undefined;
      const searchMinPrice = lsData?.filters?.minPrice as number | undefined;
      const searchMaxPrice = lsData?.filters?.maxPrice as number | undefined;
      const searchType = lsData?.filters?.type as string | undefined;

      // Signal 2: most-frequently-viewed city from listing_views history
      const cityFreq: Record<string, number> = {};
      for (const v of views) {
        const c = v.listing?.location?.split(",")[0]?.trim();
        if (c) cityFreq[c] = (cityFreq[c] ?? 0) + 1;
      }
      const topViewedCity = Object.entries(cityFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const preferredCity = searchCity ?? topViewedCity;
      const hasSearchSignals = !!(searchCity || searchMinPrice != null || searchMaxPrice != null || searchType);

      const buildRecQuery = (withCity: boolean) => {
        let q = supabase!.from("listings")
          .select("id, title, price, location, images, boosted_at, created_at, type");
        if (withCity && preferredCity) q = q.ilike("location", `%${preferredCity}%`);
        if (searchMinPrice != null) q = q.gte("price", searchMinPrice);
        if (searchMaxPrice != null) q = q.lte("price", searchMaxPrice);
        if (searchType) q = q.eq("type", searchType);
        return q
          .order("boosted_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(8);
      };

      const { data: recListings } = await buildRecQuery(true);
      let recs = (recListings as RecommendedListing[] | null) ?? [];

      // If city-filtered results are empty, try without city but keep budget/type
      if (recs.length === 0 && preferredCity) {
        const { data: fallbackRecs } = await buildRecQuery(false);
        recs = (fallbackRecs as RecommendedListing[] | null) ?? [];
        setRecommendedListings(recs);
        setRecommendationReason(null);
      } else {
        setRecommendedListings(recs);
        if (hasSearchSignals) {
          setRecommendationReason({ key: "search" });
        } else if (topViewedCity) {
          setRecommendationReason({ key: "city", city: topViewedCity });
        } else {
          setRecommendationReason(null);
        }
      }

      // Fetch favorited listing IDs for quick-action hearts
      const { data: favData } = await supabase!.from("favorites").select("listing_id").eq("user_id", user!.id);
      if (favData) setFavoritedIds(new Set((favData as { listing_id: string }[]).map((f) => f.listing_id)));

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

        // Weekly stats + per-listing view counts
        const [{ count: weekViews }, { count: weekReactions }, { count: weekBoosts }, { data: viewCountsData }] = await Promise.all([
          supabase!.from("listing_views").select("*", { count: "exact", head: true })
            .in("listing_id", listingIds).gte("viewed_at", weekStart.toISOString()),
          supabase!.from("applications").select("*", { count: "exact", head: true })
            .in("listing_id", listingIds).gte("created_at", weekStart.toISOString()),
          supabase!.from("boost_logs").select("*", { count: "exact", head: true })
            .eq("user_id", user!.id).gte("created_at", weekStart.toISOString()),
          supabase!.from("listing_views").select("listing_id").in("listing_id", listingIds),
        ]);
        setWeeklyStats({ views: weekViews ?? 0, reactions: weekReactions ?? 0, boosts: weekBoosts ?? 0 });
        const counts: Record<string, number> = {};
        ((viewCountsData ?? []) as { listing_id: string }[]).forEach((v) => {
          counts[v.listing_id] = (counts[v.listing_id] ?? 0) + 1;
        });
        setListingViewCounts(counts);

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
        await supabase.rpc("send_message", {
          p_conversation_id: convId,
          p_body: replyText.trim(),
        });
      }
    }

    if (app) {
      const { data: applicantPrefs } = await supabase.from("profiles").select("notify_application_update").eq("id", app.applicant_id).maybeSingle();
      if (applicantPrefs?.notify_application_update !== false) {
        await supabase.rpc("notify_application_event", {
          p_application_id: appId,
          p_event: status === "accepted" ? "application_accepted" : "application_rejected",
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
    toast.success(`🚀 ${t("dashboard.boostSuccess2")}`);
    setMyListings((prev) => prev.map((l) => l.id === listingId ? { ...l, boosted_at: new Date().toISOString() } : l));
    setProfile((p) => p ? { ...p, boost_credits: Math.max(0, (p.boost_credits ?? 0) - 1) } : p);
  }

  async function handleDeleteListingFromDashboard(listingId: string) {
    if (!supabase || !user) return;
    setDeletingListingId(null);
    const { error } = await supabase.rpc("delete_listing", { p_listing_id: listingId });
    if (error) {
      console.error("[DashboardPage] delete_listing RPC error:", error.message, error.details, error.hint);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
      return;
    }
    toast.success("Advertentie verwijderd.");
    setMyListings((prev) => prev.filter((l) => l.id !== listingId));
  }

  async function handleToggleFavorite(listingId: string) {
    if (!supabase || !user) return;
    const isFav = favoritedIds.has(listingId);
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("listing_id", listingId);
      setFavoritedIds((prev) => { const next = new Set(prev); next.delete(listingId); return next; });
      setFavoritesCount((c) => Math.max(0, c - 1));
      toast.success("Verwijderd uit favorieten.");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId });
      setFavoritedIds((prev) => new Set([...prev, listingId]));
      setFavoritesCount((c) => c + 1);
      toast.success("Opgeslagen als favoriet! ❤️");
    }
  }

  function handleQuickApply(listingId: string) {
    setApplyModalListingId(listingId);
    setApplyModalMessage("");
    setApplyModalBudget("");
  }

  async function submitApplyModal() {
    if (!supabase || !user || !applyModalListingId) return;
    const msg = applyModalMessage.trim();
    if (!msg) return;
    if (!profile?.phone) {
      setQuickApplyListingId(applyModalListingId);
      setApplyModalListingId(null);
      setPhoneModalOpen(true);
      return;
    }
    setApplyModalLoading(true);
    const budget = applyModalBudget ? parseFloat(applyModalBudget) : null;
    const { error } = await supabase.from("applications").insert({
      listing_id: applyModalListingId,
      applicant_id: user.id,
      message: msg,
      budget,
      status: "pending",
    });
    setApplyModalLoading(false);
    if (error) {
      if (error.code === "23505") { toast.error("Je hebt al gereageerd op deze woning."); }
      else { toast.error("Reageren mislukt. Probeer het opnieuw."); }
      return;
    }
    toast.success("Reactie verstuurd!");
    setMyApplications((prev) => [
      { id: crypto.randomUUID(), listing_id: applyModalListingId!, applicant_id: user.id, message: msg, budget, status: "pending", created_at: new Date().toISOString(), landlord_reply: null, listings: null },
      ...prev,
    ]);
    // Fire notification email — fire-and-forget, does not block the UI
    const capturedListingId = applyModalListingId;
    const capturedMsg = msg;
    setApplyModalListingId(null);
    setApplyModalMessage("");
    setApplyModalBudget("");
    supabase.from("listings").select("title, user_id").eq("id", capturedListingId).maybeSingle()
      .then(async ({ data: listingRow }) => {
        if (!listingRow) return;
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email, notify_email_applications")
          .eq("id", (listingRow as { user_id: string }).user_id)
          .maybeSingle();
        if (!ownerProfile) return;
        const email   = (ownerProfile as { email?: string }).email;
        const notifyOn = (ownerProfile as { notify_email_applications?: boolean }).notify_email_applications !== false;
        if (notifyOn && email) {
          supabase.functions.invoke("send-application-email", {
            body: {
              landlord_email:      email,
              listing_title:       (listingRow as { title: string }).title,
              application_message: capturedMsg,
            },
          }).catch((err) => console.error("[DashboardPage] send-application-email (modal) failed:", err));
        }
      })
      .catch((err) => console.error("[DashboardPage] owner lookup (modal) failed:", err));
  }

  async function submitQuickApplication(listingId: string) {
    if (!supabase || !user) return;
    setQuickApplyLoading(true);
    const defaultMsg = "Hoi, ik heb interesse in deze woning. Ik reageer snel! Graag zou ik meer informatie willen ontvangen.";
    const { error } = await supabase.from("applications").insert({
      listing_id: listingId,
      applicant_id: user.id,
      message: defaultMsg,
      status: "pending",
    });
    setQuickApplyLoading(false);
    if (error) {
      if (error.code === "23505") { toast.error("Je hebt al gereageerd op deze woning."); }
      else { toast.error("Reageren mislukt. Probeer het opnieuw."); }
      return;
    }
    toast.success("Reactie verstuurd!");
    setMyApplications((prev) => [
      { id: crypto.randomUUID(), listing_id: listingId, applicant_id: user.id, message: defaultMsg, budget: null, status: "pending", created_at: new Date().toISOString(), landlord_reply: null, listings: null },
      ...prev,
    ]);
    // Fire notification email — fire-and-forget, does not block the UI
    supabase.from("listings").select("title, user_id").eq("id", listingId).maybeSingle()
      .then(async ({ data: listingRow }) => {
        if (!listingRow) return;
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email, notify_email_applications")
          .eq("id", (listingRow as { user_id: string }).user_id)
          .maybeSingle();
        if (!ownerProfile) return;
        const email    = (ownerProfile as { email?: string }).email;
        const notifyOn = (ownerProfile as { notify_email_applications?: boolean }).notify_email_applications !== false;
        if (notifyOn && email) {
          supabase.functions.invoke("send-application-email", {
            body: {
              landlord_email:      email,
              listing_title:       (listingRow as { title: string }).title,
              application_message: defaultMsg,
            },
          }).catch((err) => console.error("[DashboardPage] send-application-email (quick) failed:", err));
        }
      })
      .catch((err) => console.error("[DashboardPage] owner lookup (quick) failed:", err));
  }

  async function handleSavePhoneAndApply() {
    if (!supabase || !user || !phoneInput.trim()) return;
    setSavingPhone(true);
    const { error } = await supabase.from("profiles").update({ phone: phoneInput.trim() }).eq("id", user.id);
    setSavingPhone(false);
    if (error) { toast.error("Telefoonnummer opslaan mislukt."); return; }
    setProfile((p) => p ? { ...p, phone: phoneInput.trim() } : p);
    setPhoneModalOpen(false);
    setPhoneInput("");
    const listingId = quickApplyListingId;
    setQuickApplyListingId(null);
    if (listingId) await submitQuickApplication(listingId);
  }

  async function handleClearApplications() {
    if (!supabase || !user) return;
    setClearingApplications(true);
    const ids = myApplications.map((a) => a.id);
    const { error } = await supabase.from("applications").update({ hidden_by_tenant: true }).in("id", ids);
    setClearingApplications(false);
    if (error) toast.error("Wissen mislukt. Probeer het opnieuw.");
    else { setMyApplications([]); setConfirmClearApplications(false); toast.success("Aanvragen gearchiveerd."); }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">{t("dashboard.guestDesc")}</h1>
        <Link href="/inloggen?next=/dashboard" data-testid="dashboard-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">{t("dashboard.loginBtn")}</Link>
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
    pending: { label: t("dashboard.statusPending"), cls: "bg-amber-50 text-amber-700 border-amber-200" },
    accepted: { label: t("dashboard.statusAccepted"), cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: t("dashboard.statusRejected"), cls: "bg-stone-100 text-stone-500 border-stone-200" },
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

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 border border-stone-200">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-stone-500">{initial}</span>}
            </div>
            <div>
              <h1 className="text-base font-semibold text-stone-900">
                {loading ? t("common.loading") : (profile?.name ?? profile?.email ?? user?.email ?? t("nav.user"))}
              </h1>
              <p className="text-xs text-stone-500">{user?.email}</p>
            </div>
          </div>
          {effectiveTab === "verhuur" ? (
            <div className="flex gap-3">
              <Link href="/profiel" data-testid="dashboard-edit-profile"
                className="flex flex-1 items-center justify-center rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
              >
                {t("nav.profile")}
              </Link>
              <Link href="/kamers/nieuw" data-testid="dashboard-new-listing"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-[0.99]"
              >
                <span className="leading-none">+</span>
                {t("nav.postListing")}
              </Link>
            </div>
          ) : (
            <Link href="/profiel" data-testid="dashboard-edit-profile"
              className="w-fit rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
            >
              {t("nav.profile")}
            </Link>
          )}
        </div>

        {/* ── Profile completion banner ─────────────────────────────────────── */}
        {!loading && !profile?.user_type && !bannerDismissed && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white px-4 py-3">
            <p className="text-sm text-stone-600">
              {t("dashboard.profileIncompleteDesc")}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => navigate("/profiel")} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50">
                {t("dashboard.completeProfile")}
              </button>
              <button type="button" aria-label="Sluiten"
                onClick={() => { localStorage.setItem(BANNER_KEY, "1"); setBannerDismissed(true); }}
                className="text-stone-400 transition hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showTabBar && (
          <div className="mt-6 flex gap-2 border-b border-stone-200">
            <button onClick={() => setActiveTab("zoektocht")} className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "zoektocht" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              <Search className="h-4 w-4" />
              {t("dashboard.tabSearch")}
            </button>
            <button onClick={() => setActiveTab("verhuur")} className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "verhuur" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              <Home className="h-4 w-4" />
              {t("dashboard.tabRental")}
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
          <div className="mt-4 space-y-4">

            {/* Stats — compact 3-column */}
            {(() => {
              const stats = [
                {
                  label: t("dashboard.statsListings"),
                  value: loading ? "…" : myListings.length,
                  href: "#listings",
                  sub: null as string | null,
                  cta: !loading && myListings.length === 0 ? { label: t("nav.postListing"), href: "/kamers/nieuw" } : null,
                },
                {
                  label: t("dashboard.statsApplications"),
                  value: loading ? "…" : pendingCount,
                  href: "#aanvragen",
                  sub: !loading && recentLandlordApplicationsCount ? t("dashboard.statsNew", { count: recentLandlordApplicationsCount }) : null,
                  cta: null,
                },
                {
                  label: t("dashboard.statsMessages"),
                  value: loading ? "…" : unreadLandlordMsgCount,
                  href: "/berichten",
                  sub: null,
                  cta: null,
                },
              ];
              return (
                <div className="grid grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <a key={stat.label} href={stat.href}
                      className="flex flex-col gap-0.5 rounded-lg border border-stone-200 bg-white px-3 py-3 transition hover:bg-stone-50"
                    >
                      <p className="text-[11px] text-stone-400 truncate">{stat.label}</p>
                      <p className="text-lg font-semibold text-stone-900">{stat.value}</p>
                      {stat.sub && <p className="text-[11px] text-stone-400">{stat.sub}</p>}
                      {stat.cta && (
                        <Link href={stat.cta.href} onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 text-[11px] font-medium text-rose-500 hover:underline"
                        >
                          {stat.cta.label} →
                        </Link>
                      )}
                    </a>
                  ))}
                </div>
              );
            })()}

            {/* Quick performance — this week */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
              <span className="font-medium text-stone-600">{t("dashboard.thisWeek")}</span>
              {loading || !weeklyStats ? (
                <span className="h-3.5 w-28 animate-pulse rounded-full bg-stone-200" />
              ) : weeklyStats.views === 0 && weeklyStats.reactions === 0 ? (
                <span className="text-stone-400">{t("dashboard.noActivityYet")}</span>
              ) : (
                <>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /><span className="font-medium text-stone-700">{weeklyStats.views}</span> {t("dashboard.viewsLabel")}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /><span className="font-medium text-stone-700">{weeklyStats.reactions}</span> {t("dashboard.reactionsLabel")}</span>
                </>
              )}
            </div>

            {/* Next Best Action — contextual guidance */}
            {!loading && myListings.length > 0 && (() => {
              const suggestions: { icon: React.ReactNode; title: string; desc: string; href: string; cta: string }[] = [];
              const listingWithoutPhotos = myListings.find((l) => !Array.isArray(l.images) || l.images.length === 0);
              if (listingWithoutPhotos) {
                suggestions.push({
                  icon: <Camera className="h-4 w-4 text-stone-400" />,
                  title: t("dashboard.suggAddPhotos"),
                  desc: t("dashboard.suggAddPhotosDesc"),
                  href: `/kamers/${listingWithoutPhotos.id}/bewerken`,
                  cta: t("dashboard.suggAddPhotosCta"),
                });
              }
              if (weeklyStats && weeklyStats.views < 5) {
                suggestions.push({
                  icon: <RefreshCw className="h-4 w-4 text-stone-400" />,
                  title: t("dashboard.suggRefresh"),
                  desc: t("dashboard.suggRefreshDesc"),
                  href: myListings[0] ? `/kamers/${myListings[0].id}/bewerken` : "#listings",
                  cta: t("dashboard.suggRefreshCta"),
                });
              }
              if (pendingCount === 0 && receivedApplications.length === 0) {
                suggestions.push({
                  icon: <FileText className="h-4 w-4 text-stone-400" />,
                  title: t("dashboard.suggImprove"),
                  desc: t("dashboard.suggImproveDesc"),
                  href: myListings[0] ? `/kamers/${myListings[0].id}/bewerken` : "#listings",
                  cta: t("dashboard.suggImproveCta"),
                });
              }
              if (!profile?.phone) {
                suggestions.push({
                  icon: <ShieldCheck className="h-4 w-4 text-stone-400" />,
                  title: t("dashboard.suggPhone"),
                  desc: t("dashboard.suggPhoneDesc"),
                  href: "/profiel",
                  cta: t("dashboard.suggPhoneCta"),
                });
              }
              if (suggestions.length === 0) return null;
              const top = suggestions.slice(0, 2);
              return (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-stone-400">{t("dashboard.suggestions")}</p>
                  <div className="space-y-2">
                    {top.map((s) => (
                      <Link key={s.title} href={s.href}
                        className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-stone-300 hover:bg-stone-50"
                      >
                        <span className="mt-0.5 shrink-0">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-800">{s.title}</p>
                          <p className="text-xs text-stone-500 leading-snug">{s.desc}</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-rose-600 whitespace-nowrap">{s.cta}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 4. Mijn Advertenties */}
            <div id="listings">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900">{t("dashboard.myListings")}</h2>
                <Link href="/kamers/nieuw" className="text-sm font-medium text-rose-600 hover:underline">+ {t("dashboard.newListing")}</Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => <div key={n} className="h-24 animate-pulse rounded-2xl bg-stone-200" />)}
                </div>
              ) : myListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white px-6 py-12 text-center">
                  <Home className="h-8 w-8 text-stone-300" />
                  <h3 className="mt-3 text-sm font-semibold text-stone-800">{t("dashboard.noListingsTitle")}</h3>
                  <p className="mt-1 max-w-sm text-sm text-stone-500">{t("dashboard.noListingsFirstDesc")}</p>
                  <Link href="/kamers/nieuw" className="mt-4 rounded-lg border border-rose-200 bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
                    {t("dashboard.createFirstListing")}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const allViewCounts = Object.values(listingViewCounts);
                    const avgViews = allViewCounts.length > 0 ? allViewCounts.reduce((a, b) => a + b, 0) / allViewCounts.length : 0;
                    const allAppCounts = myListings.map((l) => receivedApplications.filter((a) => a.listing_id === l.id).length);
                    const avgApps = allAppCounts.length > 0 ? allAppCounts.reduce((a, b) => a + b, 0) / allAppCounts.length : 0;
                    return myListings.map((l) => {
                      const boosted = isBoostActive(l.boosted_at ?? null);
                      const appCount = receivedApplications.filter((a) => a.listing_id === l.id).length;
                      const convCount = landlordConversations.filter((c) => c.listing_id === l.id).length;
                      const viewCount = listingViewCounts[l.id] ?? 0;
                      const img = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
                      const isDropdownOpen = openDropdownId === l.id;
                      const updatedAt = (l as unknown as { updated_at?: string }).updated_at ?? l.created_at;
                      const daysSinceUpdate = updatedAt
                        ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000)
                        : null;
                      const isPopular = myListings.length > 1 && (viewCount > avgViews * 1.5 || appCount > avgApps * 1.5);
                      return (
                        <div key={l.id} className={`relative flex flex-col gap-3 overflow-hidden rounded-lg border p-4 sm:flex-row sm:items-start transition-colors ${boosted ? "border-amber-200 bg-amber-50/20" : "border-stone-200 bg-white"}`}>
                          {/* Delete confirm overlay */}
                          {deletingListingId === l.id && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/95 p-4 text-center backdrop-blur-sm">
                              <p className="text-sm font-medium text-stone-800">{t("dashboard.confirmDeleteListing")} "{l.title}"</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleDeleteListingFromDashboard(l.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">
                                  {t("common.confirmDelete")}
                                </button>
                                <button type="button" onClick={() => setDeletingListingId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">
                                  {t("common.cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Thumbnail */}
                          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                            {img
                              ? <img src={img} alt={l.title} className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                                  <Camera className="h-5 w-5 text-stone-300" />
                                  <p className="text-[10px] text-stone-300">{t("common.noPhoto")}</p>
                                </div>}
                          </div>
                          {/* Info */}
                          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-stone-900 truncate leading-snug">{l.title}</p>
                              {boosted && (
                                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                                  <Zap className="h-3 w-3" /> {t("dashboard.boostedBadge")}
                                </span>
                              )}
                              {isPopular && (
                                <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-400">
                                  {t("dashboard.popularBadge")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-stone-800">€{Number(l.price).toLocaleString("nl-NL")}<span className="text-xs font-normal text-stone-400">/mnd</span></p>
                            <p className="text-xs text-stone-400 truncate">{l.location}</p>
                            {daysSinceUpdate !== null && daysSinceUpdate > 0 && (
                              <p className="text-xs text-stone-300">{t("dashboard.daysAgoUpdated", { days: daysSinceUpdate })}</p>
                            )}
                            <ListingAnalyticsStrip
                              viewCount={viewCount}
                              conversationCount={convCount}
                              boosted={boosted}
                              boostedAt={l.boosted_at ?? null}
                            />
                          </div>
                          {/* Quick actions */}
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            <Link
                              href={`/kamers/${l.id}/bewerken`}
                              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              {t("dashboard.editBtn")}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              {!boosted && (profile?.boost_credits ?? 0) > 0 && (
                                <button
                                  type="button"
                                  disabled={boostingId === l.id}
                                  onClick={() => handleBoostListing(l.id)}
                                  className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[11px] font-medium text-stone-500 transition hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 disabled:opacity-50"
                                  title="Boost gebruiken"
                                >
                                  <Zap className="h-3 w-3" />
                                  {boostingId === l.id ? t("dashboard.boosting") : t("dashboard.boostListing")}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeletingListingId(l.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-300 transition hover:bg-rose-50 hover:text-rose-500"
                                aria-label="Verwijderen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* 5. Aanvragen */}
            <div id="aanvragen">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-lg font-bold text-stone-900">{t("dashboard.receivedApplications")}</h2>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white">{pendingCount} {t("common.new")}</span>
                )}
              </div>
              {loading ? (
                <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}</div>
              ) : receivedApplications.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-8">
                  <p className="text-sm font-semibold text-stone-700">{t("dashboard.noReceivedApplications")}</p>
                  <p className="mt-1 text-xs text-stone-500">{t("dashboard.noReceivedApplications")}</p>
                  <div className="mt-4 space-y-2">
                    {[
                      { text: t("dashboard.suggAddPhotos"), href: myListings[0] ? `/kamers/${myListings[0].id}/bewerken` : "/kamers/nieuw" },
                      { text: t("dashboard.suggImprove"), href: myListings[0] ? `/kamers/${myListings[0].id}/bewerken` : "/kamers/nieuw" },
                      { text: t("dashboard.suggRefresh"), href: "/pricing" },
                    ].map((tip) => (
                      <Link
                        key={tip.text}
                        href={tip.href}
                        className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        {tip.text}
                        <span className="text-stone-400">→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedApplications.map((app) => {
                    const name = app.profiles?.name ?? app.profiles?.email ?? t("common.unknown");
                    const avatarInitial = name.slice(0, 1).toUpperCase();
                    const badge = statusMap[app.status as keyof typeof statusMap] ?? statusMap.pending;
                    const isApplicantVerified = isFullyVerified(null, app.profiles as { phone_verified?: boolean | null; email_auto_verified?: boolean | null } | null);
                    const conv = landlordConversations.find((c) => c.listing_id === app.listing_id && c.tenant_id === app.applicant_id);
                    return (
                      <div key={app.id} className="relative flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4 pr-10 sm:flex-row sm:items-start">
                        {confirmDeleteId === app.id && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/95 p-4 text-center backdrop-blur-sm">
                            <p className="text-sm font-medium text-stone-800">{t("dashboard.confirmDeleteApp")}</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleDeleteApplication(app.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">{t("common.confirmDelete")}</button>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">{t("common.cancel")}</button>
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
                                <ShieldCheck className="h-3 w-3" /> {t("dashboard.verifiedBadge")}
                              </span>
                            )}
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {app.listings?.title && (
                            <p className="text-xs text-stone-500"><span className="font-medium text-stone-600">{t("dashboard.advertisementLabel")}</span> {app.listings.title}</p>
                          )}
                          <p className="text-sm text-stone-600 line-clamp-2">{app.message}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                            {app.budget != null && <span className="font-medium text-stone-600">{t("dashboard.budgetLabel")} €{Number(app.budget).toFixed(0)}</span>}
                            <span>{new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {app.status === "accepted" && conv && (
                            <Link href={`/berichten/${conv.id}`} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600">{t("dashboard.convLink")}</Link>
                          )}
                          {app.status === "pending" && inlineReply?.appId !== app.id && (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setInlineReply({ appId: app.id, action: "accepted", text: "" })} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-95">{t("dashboard.acceptApplication")}</button>
                              <button type="button" onClick={() => setInlineReply({ appId: app.id, action: "rejected", text: "" })} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 active:scale-95">{t("dashboard.rejectApplication")}</button>
                            </div>
                          )}
                          {app.status === "pending" && inlineReply?.appId === app.id && (
                            <div className="w-full min-w-[220px] rounded-2xl border border-stone-200 bg-stone-50 p-3 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{t("dashboard.inlineReplyHint")}</p>
                              <textarea rows={3} maxLength={300} placeholder={t("dashboard.inlineReplyPlaceholder")}
                                value={inlineReply.text}
                                onChange={(e) => setInlineReply((r) => r ? { ...r, text: e.target.value } : r)}
                                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleApplicationStatus(app.id, inlineReply.action, inlineReply.text)}
                                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white transition active:scale-95 ${inlineReply.action === "accepted" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-stone-500 hover:bg-stone-600"}`}
                                >
                                  {inlineReply.action === "accepted" ? (inlineReply.text.trim() ? `${t("dashboard.acceptApplication")} & ${t("common.send")}` : t("dashboard.acceptApplication")) : (inlineReply.text.trim() ? `${t("dashboard.rejectApplication")} & ${t("common.send")}` : t("dashboard.rejectApplication"))}
                                </button>
                                <button type="button" onClick={() => setInlineReply(null)} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100">{t("common.cancel")}</button>
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

            {/* Boost credits — compact secondary */}
            {!loading && (profile?.role === "admin" || profile?.user_type === "verhuurder" || profile?.user_type === "huisgenoot_zoeker") && (
              <div className="flex items-center justify-between gap-4 border-t border-stone-100 pt-4 text-xs text-stone-500">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  {(profile?.boost_credits ?? 0) > 0
                    ? <>{t("dashboard.boostCreditsAvailable", { count: profile!.boost_credits, unit: (profile?.boost_credits ?? 0) === 1 ? "credit" : "credits" })}</>
                    : t("dashboard.noBoostCredits")}
                </span>
                <Link href="/pricing" className="flex items-center gap-1 text-stone-400 transition hover:text-rose-600">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("dashboard.buyCredits")}
                </Link>
              </div>
            )}

          </div>
        )}

        {/* Apply modal — message + budget form */}
        {applyModalListingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900">{t("dashboard.applyModalTitle")}</h3>
                <button type="button" onClick={() => setApplyModalListingId(null)} className="rounded-lg p-1 text-stone-400 transition hover:text-stone-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-700">{t("dashboard.applyModalMsgLabel")} <span className="text-rose-500">*</span></label>
                  <textarea
                    rows={4}
                    placeholder={t("dashboard.applyModalMsgPlaceholder")}
                    value={applyModalMessage}
                    onChange={(e) => setApplyModalMessage(e.target.value)}
                    className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-700">{t("dashboard.applyModalBudgetLabel")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">€</span>
                    <input
                      type="number"
                      placeholder={t("dashboard.applyModalBudgetPlaceholder")}
                      value={applyModalBudget}
                      onChange={(e) => setApplyModalBudget(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 py-2.5 pl-7 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={applyModalLoading || !applyModalMessage.trim()}
                  onClick={submitApplyModal}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 active:scale-95 disabled:opacity-50"
                >
                  {applyModalLoading ? t("common.sending") : t("dashboard.applyModalSend")}
                </button>
                <button
                  type="button"
                  onClick={() => setApplyModalListingId(null)}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phone number modal — Task 5 */}
        {phoneModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                  <Phone className="h-5 w-5 text-rose-500" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-stone-900">{t("dashboard.phoneModalTitle")}</h3>
                  <p className="mt-1 text-sm text-stone-500">{t("dashboard.phoneModalDesc")}</p>
                </div>
              </div>
              <input
                type="tel"
                placeholder="+31 6 12345678"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={savingPhone || !phoneInput.trim()}
                  onClick={handleSavePhoneAndApply}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95 disabled:opacity-50"
                >
                  {savingPhone ? t("common.saving") : t("dashboard.phoneSaveAndApply")}
                </button>
                <button
                  type="button"
                  onClick={() => { setPhoneModalOpen(false); setPhoneInput(""); setQuickApplyListingId(null); }}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            WONINGZOEKENDE — Application Launchpad
            ════════════════════════════════════════════════════════════════════ */}
        {effectiveTab === "zoektocht" && (() => {
          // Derive city for search continuity
          const cityFromSearch = lastSavedSearch?.filters?.city as string | undefined;
          const cityFromViews = recentViews[0]?.listing?.location?.split(",")[0]?.trim() ?? null;
          const hasSearchContext = !!(cityFromSearch ?? cityFromViews ?? lastSavedSearch);
          const searchUrl = buildSearchUrl(lastSavedSearch, cityFromViews);
          const searchSummary = buildSearchSummary(lastSavedSearch, cityFromViews, t("dashboard.searchSummaryFallback"), {
            room_for_rent: t("listings.typeRoom"),
            roommate_search: t("listings.typeRoommate"),
            short_stay: t("listings.typeShortStay"),
          });

          return (
            <div className="mt-6 space-y-6">

              {/* Search Continuity */}
              {loading ? (
                <div className="h-16 animate-pulse rounded-lg bg-stone-200" />
              ) : (hasSearchContext || recentViews.length > 0) ? (
                <Link
                  href={searchUrl}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-rose-200 hover:bg-rose-50"
                >
                  <div className="flex items-center gap-3">
                    <Search className="h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <p className="text-xs text-stone-500">{t("dashboard.continueSearchLabel")}</p>
                      <p className="text-sm font-semibold text-stone-900">{searchSummary}</p>
                      {lastSavedSearch?.name && (
                        <p className="text-xs text-stone-400">{t("dashboard.savedAs")} {lastSavedSearch.name}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <Link
                  href="/kamers"
                  className="group flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition hover:border-rose-200 hover:bg-rose-50"
                >
                  <div className="flex items-center gap-3">
                    <Search className="h-4 w-4 shrink-0 text-rose-500" />
                    <div>
                      <p className="text-xs text-stone-500">{t("dashboard.startSearch")}</p>
                      <p className="text-sm font-semibold text-stone-900">{t("dashboard.startSearchTitle")}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:translate-x-0.5" />
                </Link>
              )}

              {/* Aanbevolen voor jou — primaire sectie */}
              <div ref={recommendationsRef}>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{t("dashboard.recommendations")}</h2>
                    {recommendationReason && (
                      <p className="mt-0.5 text-xs text-stone-400">
                        {recommendationReason.key === "search"
                          ? t("dashboard.recommendationsBasis")
                          : t("dashboard.recommendationsByCity", { city: recommendationReason.city })}
                      </p>
                    )}
                  </div>
                  <Link href="/kamers" className="shrink-0 text-xs font-medium text-rose-600 hover:underline">{t("dashboard.viewAll")}</Link>
                </div>
                {loading ? (
                  <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => <div key={n} className="min-w-[200px] animate-pulse rounded-lg bg-stone-200 h-48 sm:min-w-0" />)}
                  </div>
                ) : recommendedListings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white px-6 py-12 text-center">
                    <Home className="h-8 w-8 text-stone-300" />
                    <p className="mt-3 text-sm font-semibold text-stone-800">{t("dashboard.noRecommendations")}</p>
                    <p className="mt-1 text-sm text-stone-500">{t("dashboard.noRecommendations")}</p>
                    <Link href="/kamers" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600">
                      {t("dashboard.searchSummaryFallback")}
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
                    {recommendedListings.map((l) => {
                      const thumb = Array.isArray(l.images) && l.images.length > 0 ? l.images[0] : null;
                      const boosted = isBoostActive(l.boosted_at);
                      const isNew = !boosted && new Date(l.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                      const isFav = favoritedIds.has(l.id);
                      return (
                        <div key={l.id} className="group relative flex min-w-[180px] flex-col overflow-hidden rounded-lg border border-stone-200 bg-white sm:min-w-0">
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                            <Link href={`/kamers/${l.id}`}>
                              {thumb
                                ? <img src={thumb} alt={l.title} className="h-full w-full object-cover" />
                                : <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-stone-300" /></div>}
                            </Link>
                            {boosted && (
                              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <Zap className="h-3 w-3" /> {t("dashboard.featuredBadge")}
                              </span>
                            )}
                            {isNew && !boosted && (
                              <span className="absolute left-2 top-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">{t("dashboard.newBadge")}</span>
                            )}
                            <div className="absolute right-2 top-2 flex flex-col gap-1">
                              <button type="button" aria-label={isFav ? "Verwijder uit favorieten" : "Favoriet"}
                                onClick={(e) => { e.preventDefault(); handleToggleFavorite(l.id); }}
                                className={`flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white transition ${isFav ? "text-rose-500" : "text-stone-400 hover:text-rose-500"}`}
                              >
                                <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-current" : ""}`} />
                              </button>
                              <button type="button" aria-label="Snel reageren" disabled={quickApplyLoading}
                                onClick={(e) => { e.preventDefault(); handleQuickApply(l.id); }}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 transition hover:text-amber-500 disabled:opacity-50"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col gap-0.5 p-3">
                            <p className="line-clamp-2 text-xs font-semibold text-stone-900 leading-snug">{l.title}</p>
                            <p className="text-xs text-stone-500 truncate">{l.location}</p>
                            <p className="mt-1 text-xs font-semibold text-stone-900">€{Number(l.price).toLocaleString("nl-NL")}/mnd</p>
                            <Link href={`/kamers/${l.id}`} className="mt-2 flex items-center justify-center rounded-lg border border-stone-200 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50">
                              {t("dashboard.viewProperty")}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Snelle links — compact chip-balk */}
              {!loading && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
                  <Link href="/favorieten" className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:text-rose-600">
                    <Heart className="h-3 w-3" />
                    {favoritesCount > 0 ? t("dashboard.favoritesChip", { count: favoritesCount }) : t("dashboard.saveFavorites")}
                  </Link>
                  <a href="#aanvragen" className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:text-rose-600">
                    <SendHorizontal className="h-3 w-3" />
                    {myApplications.length > 0 ? `${myApplications.length} ${myApplications.length === 1 ? t("dashboard.reactionsLabel").replace(/s$/, "") : t("dashboard.reactionsLabel")}` : t("dashboard.noApplicationsChip")}
                  </a>
                  <Link href="/opgeslagen-zoekopdrachten" className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:text-rose-600">
                    <Search className="h-3 w-3" />
                    {savedSearchesCount > 0 ? `${savedSearchesCount} ${t("dashboard.statsMessages").toLowerCase()}` : t("dashboard.saveSearchesChip")}
                  </Link>
                  <Link href="/berichten" className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:text-rose-600">
                    <MessageSquare className="h-3 w-3" />
                    {t("nav.messages")}
                  </Link>
                </div>
              )}

              {/* Mijn aanvragen */}
              <div id="aanvragen">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-stone-900">{t("dashboard.myApplications")}</h2>
                  {!loading && myApplications.length > 0 && !confirmClearApplications && (
                    <button type="button" onClick={() => setConfirmClearApplications(true)}
                      className="text-xs font-medium text-stone-400 transition hover:text-rose-500"
                    >
                      {t("dashboard.clearApplicationsBtn")}
                    </button>
                  )}
                  {confirmClearApplications && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5">
                      <p className="text-xs font-medium text-rose-800">{t("dashboard.confirmClearAppsTitle")}</p>
                      <button type="button" disabled={clearingApplications}
                        onClick={handleClearApplications}
                        className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
                      >
                        {clearingApplications ? t("common.loading") : t("dashboard.confirmYesClear")}
                      </button>
                      <button type="button" onClick={() => setConfirmClearApplications(false)}
                        className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-stone-200" />)}</div>
                ) : myApplications.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-200 bg-white px-6 py-8 text-center">
                    <SendHorizontal className="mx-auto h-6 w-6 text-stone-300" />
                    <p className="mt-3 text-sm font-semibold text-stone-800">{t("dashboard.noApplicationsYetTitle")}</p>
                    <p className="mt-1 text-sm text-stone-500">{t("dashboard.noApplicationsYetDesc")}</p>
                    <button
                      type="button"
                      onClick={() => recommendationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="mt-4 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      {t("dashboard.viewRecommended")}
                    </button>
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
                          label: t("dashboard.applicationSent"),
                          sub: new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long" }),
                          done: true,
                          active: false,
                        },
                        {
                          icon: <Eye className="h-3.5 w-3.5" />,
                          label: t("dashboard.seenByLandlord"),
                          sub: hasBeenSeen ? undefined : t("dashboard.awaiting"),
                          done: hasBeenSeen,
                          active: !hasBeenSeen && app.status === "pending",
                        },
                        {
                          icon: hasReply
                            ? (app.status === "accepted" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />)
                            : <MessageSquare className="h-3.5 w-3.5" />,
                          label: t("dashboard.replyReceived"),
                          sub: app.status === "accepted" ? t("dashboard.statusAccepted") : app.status === "rejected" ? t("dashboard.statusRejected") : undefined,
                          done: hasReply,
                          active: false,
                        },
                      ];

                      return (
                        <div key={app.id} className="relative rounded-lg border border-stone-200 bg-white p-4 pr-10">
                          {/* Delete confirm overlay */}
                          {confirmDeleteTenantId === app.id && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/95 p-4 text-center backdrop-blur-sm">
                              <p className="text-sm font-medium text-stone-800">{t("dashboard.confirmDeleteApp")}</p>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleDeleteTenantApplication(app.id)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95">{t("common.confirmDelete")}</button>
                                <button type="button" onClick={() => setConfirmDeleteTenantId(null)} className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95">{t("common.cancel")}</button>
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
                              <p className="text-sm font-semibold text-stone-900 truncate">{app.listings?.title ?? t("dashboard.startSearchTitle")}</p>
                              {app.budget != null && (
                                <p className="text-xs text-stone-400">{t("dashboard.budgetLabel")} €{Number(app.budget).toFixed(0)}</p>
                              )}
                            </div>
                            {app.listings?.id && (
                              <Link href={`/kamers/${app.listings.id}`} className="shrink-0 text-xs font-medium text-rose-500 hover:underline">
                                {t("dashboard.viewListingLink")}
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
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{t("dashboard.landlordMessage")}</p>
                                  <p className="mt-0.5 text-xs text-stone-700">{app.landlord_reply}</p>
                                </div>
                              )}
                              {app.status === "accepted" && conv && (
                                <Link href={`/berichten/${conv.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600">
                                  <MessageSquare className="h-3.5 w-3.5" /> {t("dashboard.goToConversation")}
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
                  <h2 className="text-lg font-bold text-stone-900">{t("dashboard.recentViewed")}</h2>
                  {!loading && recentViews.length > 0 && !confirmClearViews && (
                    <button type="button" onClick={() => setConfirmClearViews(true)} className="text-xs font-medium text-stone-400 transition hover:text-rose-500">
                      {t("dashboard.clearAllBtn")}
                    </button>
                  )}
                  {confirmClearViews && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
                      <p className="text-xs font-medium text-rose-800">{t("dashboard.clearHistoryConfirm")}</p>
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
                        {clearingViews ? t("common.loading") : t("dashboard.clearYesBtn")}
                      </button>
                      <button type="button" onClick={() => setConfirmClearViews(false)} className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95">{t("common.cancel")}</button>
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((n) => <div key={n} className="animate-pulse rounded-2xl bg-stone-200 h-36" />)}
                  </div>
                ) : recentViews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
                    <p className="mt-3 text-sm font-medium text-stone-700">{t("dashboard.noViewsYet")}</p>
                    <Link href="/kamers" className="mt-3 text-xs font-semibold text-rose-600 hover:underline">{t("dashboard.browsePropertiesLink")}</Link>
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

              {/* TASK 1 — Profile completion (subtle, only if missing phone number) */}
              {!loading && profile && !profile.phone && (
                <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                    <UserCircle className="h-4 w-4 text-stone-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-700">{t("dashboard.profileCompletionTitle")}</p>
                    <p className="text-xs text-stone-400">{t("dashboard.addPhonePrompt")}</p>
                  </div>
                  <Link href="/profiel" className="shrink-0 rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-700 active:scale-95">
                    {t("dashboard.completeBtn")}
                  </Link>
                </div>
              )}

            </div>
          );
        })()}

      </div>
    </>
  );
}
