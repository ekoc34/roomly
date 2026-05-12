import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { UserCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ListingCard } from "@/components/listings/ListingCard";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import type { Listing, Profile, ApplicationWithDetails } from "@/types/database";

const BANNER_KEY = "roomly_profile_banner_dismissed";

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

  const listingIdsRef = useRef<string[]>([]);
  useEffect(() => { listingIdsRef.current = myListings.map((l) => l.id); }, [myListings]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !supabase) { setLoading(false); return; }

    async function fetchData() {
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
      ]);

      if (recentViewsError) console.error("[listing_views] select failed:", recentViewsError.message);
      setProfile(p as Profile | null);
      setFavoritesCount(favCount ?? 0);
      setTenantConvsCount(tenantConvCount ?? 0);
      setLandlordConvsCount(landlordConvCount ?? 0);
      setSavedSearchesCount(savedCount ?? 0);
      setRecentViews((recentViewsData as RecentView[] | null) ?? []);
      setMyApplications((myApps as MyApplication[] | null) ?? []);
      setTenantConversations((tenantConvData as ConvSummary[] | null) ?? []);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: recentCount, error: recentErr } = await supabase!
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("applicant_id", user!.id)
        .eq("hidden_by_tenant", false)
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
            .in("listing_id", listingIds)
            .eq("hidden_by_landlord", false)
            .order("created_at", { ascending: false }),
          supabase!
            .from("conversations")
            .select("id, listing_id, tenant_id")
            .in("listing_id", listingIds),
        ]);
        setReceivedApplications((apps as ApplicationWithDetails[] | null) ?? []);
        setLandlordConversations((landlordConvData as ConvSummary[] | null) ?? []);

        const thirtyDaysAgoLandlord = new Date();
        thirtyDaysAgoLandlord.setDate(thirtyDaysAgoLandlord.getDate() - 30);
        const { count: recentLandlordCount, error: recentLandlordErr } = await supabase!
          .from("applications")
          .select("id", { count: "exact", head: true })
          .in("listing_id", listingIds)
          .eq("status", "pending")
          .eq("hidden_by_landlord", false)
          .gte("created_at", thirtyDaysAgoLandlord.toISOString());
        if (!recentLandlordErr) setRecentLandlordApplicationsCount(recentLandlordCount ?? 0);
      }

      setLoading(false);
    }
    fetchData();
  }, [user, authLoading]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`landlord-applications-rt-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        (payload) => {
          const row = payload.new as {
            id: string; listing_id: string; applicant_id: string;
            message: string; budget: number | null; status: string;
            hidden_by_landlord: boolean; contact_revealed: boolean; created_at: string;
            landlord_reply?: string | null;
          };
          if (!listingIdsRef.current.includes(row.listing_id)) return;
          if (row.hidden_by_landlord) return;
          const newApp: ApplicationWithDetails = {
            ...row,
            landlord_reply: row.landlord_reply ?? null,
            status: row.status as ApplicationWithDetails["status"],
            profiles: null,
            listings: null,
          };
          setReceivedApplications((prev) => {
            if (prev.some((a) => a.id === row.id)) return prev;
            return [newApp, ...prev];
          });
          setRecentLandlordApplicationsCount((prev) => (prev !== null ? prev + 1 : 1));
          if (supabase) {
            Promise.all([
              supabase
                .from("profiles")
                .select("name, email, avatar_url, phone_verified, email_auto_verified, student_verified, verification_badge")
                .eq("id", row.applicant_id)
                .maybeSingle(),
              supabase
                .from("listings")
                .select("title")
                .eq("id", row.listing_id)
                .maybeSingle(),
            ]).then(([{ data: profile }, { data: listing }]) => {
              setReceivedApplications((prev) =>
                prev.map((a) =>
                  a.id === row.id
                    ? {
                        ...a,
                        profiles: profile as ApplicationWithDetails["profiles"] ?? null,
                        listings: listing ? { title: listing.title } : null,
                      }
                    : a
                )
              );
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function handleApplicationStatus(appId: string, status: "accepted" | "rejected", replyText?: string) {
    if (!supabase || !user) return;
    const { error } = await supabase
      .from("applications")
      .update({ status, landlord_reply: replyText?.trim() || null })
      .eq("id", appId);
    if (error) {
      toast.error("Er ging iets mis, probeer opnieuw.");
      return;
    }

    const app = receivedApplications.find((a) => a.id === appId);
    let convId: string | null = null;

    // Always create/find a conversation on accept; also create one on reject if a reply message was given.
    // Uses the upsert_conversation RPC (security definer) because the default conversations RLS policy
    // only allows INSERT when auth.uid() = tenant_id — the landlord would be blocked otherwise.
    if (app && (status === "accepted" || (status === "rejected" && replyText?.trim()))) {
      const { data: upsertedId, error: convError } = await supabase.rpc("upsert_conversation", {
        p_listing_id: app.listing_id,
        p_tenant_id: app.applicant_id,
        p_landlord_id: user.id,
      });

      if (convError) {
        console.error("[DashboardPage] upsert_conversation RPC failed:", convError.code, convError.message, convError.details);
        toast.error("Gesprek aanmaken mislukt. Controleer of de upsert_conversation functie in Supabase is aangemaakt.");
        return;
      }

      if (upsertedId) {
        convId = upsertedId as string;
        setLandlordConversations((prev) => {
          if (prev.find((c) => c.id === convId)) return prev;
          return [...prev, { id: convId!, listing_id: app.listing_id, tenant_id: app.applicant_id }];
        });
      }

      // Insert the landlord's reply as the first message in the conversation
      if (replyText?.trim() && convId) {
        const { error: msgError } = await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id: user.id,
          body: replyText.trim(),
        });
        if (msgError) {
          console.error("[DashboardPage] Message insert failed:", msgError.code, msgError.message);
        }
      }
    }

    if (app) {
      const listingTitle = app.listings?.title ?? "een woning";
      const replySnippet = replyText?.trim()
        ? `\n\nBericht van verhuurder:\n"${replyText.trim()}"`
        : "";
      const { data: applicantPrefs } = await supabase
        .from("profiles")
        .select("notify_application_update")
        .eq("id", app.applicant_id)
        .maybeSingle();
      if (applicantPrefs?.notify_application_update !== false) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: app.applicant_id,
          type: status === "accepted" ? "application_accepted" : "application_rejected",
          title: status === "accepted" ? "Aanvraag geaccepteerd!" : "Aanvraag afgewezen",
          body:
            status === "accepted"
              ? `Je aanvraag voor "${listingTitle}" is geaccepteerd. Je kunt nu het gesprek bekijken.${replySnippet}`
              : `Je aanvraag voor "${listingTitle}" is helaas niet doorgegaan.${replySnippet}`,
          related_id: convId ?? null,
          read: false,
        });
        if (notifErr) {
          console.error("[DashboardPage] notification insert failed — is the notifications table created in Supabase?", notifErr);
        }
      }
    }

    setInlineReply(null);
    setReceivedApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status } : a))
    );
    toast.success(
      status === "accepted"
        ? "Aanvraag geaccepteerd. Er is een gesprek aangemaakt."
        : "Aanvraag afgewezen."
    );
  }

  async function handleDeleteTenantApplication(appId: string) {
    if (!supabase || !user) return;
    setConfirmDeleteTenantId(null);
    setMyApplications((prev) => prev.filter((a) => a.id !== appId));
    const { error } = await supabase
      .from("applications")
      .update({ hidden_by_tenant: true })
      .eq("id", appId);
    if (error) {
      console.error("[DashboardPage] Failed to hide tenant application:", error);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    } else {
      toast.success("Aanvraag verwijderd.");
    }
  }

  async function handleDeleteApplication(appId: string) {
    if (!supabase || !user) return;
    setConfirmDeleteId(null);
    setReceivedApplications((prev) => prev.filter((a) => a.id !== appId));
    const { error } = await supabase
      .from("applications")
      .update({ hidden_by_landlord: true })
      .eq("id", appId);
    if (error) {
      console.error("[DashboardPage] Failed to hide application:", error);
      toast.error("Verwijderen mislukt. Probeer het opnieuw.");
    } else {
      toast.success("Aanvraag verwijderd.");
    }
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
  const ZOEK_TYPES = ["student", "professional", "alleenstaande", "family"];
  const effectiveTab: Tab = !loading && profile?.user_type
    ? (VERHUUR_TYPES.includes(profile.user_type) ? "verhuur" : "zoektocht")
    : activeTab;
  const showTabBar = !loading && !profile?.user_type;

  const statusMap = {
    pending: { label: "In behandeling", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    accepted: { label: "Geaccepteerd", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Afgewezen", cls: "bg-stone-100 text-stone-500 border-stone-200" },
  };

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
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 shadow-sm">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-stone-500">{initial}</span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">{loading ? "Laden…" : (profile?.name ?? profile?.email ?? user?.email ?? "Gebruiker")}</h1>
              <p className="text-sm text-stone-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/profiel" className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" data-testid="dashboard-edit-profile">
              Profiel bewerken
            </Link>
            {VERHUUR_TYPES.includes(profile?.user_type ?? "") && (
              <Link href="/kamers/nieuw" className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95" data-testid="dashboard-new-listing">
                + Advertentie plaatsen
              </Link>
            )}
          </div>
        </div>

        {/* Profile completion banner — shown only when user_type is NULL and not yet dismissed */}
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
              <button
                type="button"
                onClick={() => navigate("/profiel")}
                className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
              >
                Profiel aanvullen
              </button>
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => {
                  localStorage.setItem(BANNER_KEY, "1");
                  setBannerDismissed(true);
                }}
                className="rounded-lg p-1 text-amber-500 transition hover:bg-amber-100 hover:text-amber-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showTabBar && (
          <div className="mt-8 flex gap-2 border-b border-stone-200">
            <button
              onClick={() => setActiveTab("zoektocht")}
              className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "zoektocht" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Mijn zoektocht
            </button>
            <button
              onClick={() => setActiveTab("verhuur")}
              className={`flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === "verhuur" ? "border-rose-500 text-rose-600" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Mijn verhuur
              {!loading && pendingCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{pendingCount}</span>
              )}
            </button>
          </div>
        )}

        {effectiveTab === "zoektocht" && (
          <div className="mt-6 space-y-8">

            {/* ── Profile completion ── */}
            {!loading && profile && (() => {
              const fields: { key: string; pct: number; label: string; missing: string }[] = [
                { key: "name",      pct: 20, label: "naam",            missing: "Voeg je naam toe" },
                { key: "email",     pct: 20, label: "e-mail",          missing: "Voeg je e-mailadres toe" },
                { key: "phone",     pct: 20, label: "telefoon",        missing: "Voeg je telefoonnummer toe" },
                { key: "user_type", pct: 20, label: "woonsituatie",    missing: "Kies je woonsituatie" },
                { key: "bio",       pct: 10, label: "bio",             missing: "Schrijf een korte bio" },
                { key: "avatar_url",pct: 10, label: "profielfoto",     missing: "Voeg een profielfoto toe" },
              ];

              const pct = fields.reduce((sum, f) => {
                const val = profile[f.key as keyof typeof profile];
                return sum + (val ? f.pct : 0);
              }, 0);

              const missing = fields.filter((f) => {
                const val = profile[f.key as keyof typeof profile];
                return !val;
              });

              const isComplete = pct === 100;

              return (
                <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-stone-900">Profiel voltooiing</p>
                    {isComplete ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Je profiel is compleet!
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-stone-500">
                        <span className="font-semibold text-stone-800">{pct}%</span> compleet
                      </span>
                    )}
                  </div>

                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {!isComplete && missing.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {missing.map((f) => (
                        <li key={f.key} className="flex items-center justify-between gap-3 text-sm text-stone-600">
                          <span className="flex items-center gap-2">
                            <svg className="h-3.5 w-3.5 shrink-0 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            {f.missing}
                          </span>
                          <Link href="/profiel" className="shrink-0 text-xs font-medium text-rose-600 hover:underline">
                            Toevoegen
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Opgeslagen woningen",
                  value: loading ? "…" : favoritesCount,
                  href: "/favorieten",
                  icon: <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
                },
                {
                  label: "Gesprekken",
                  value: loading ? "…" : tenantConvsCount,
                  href: "/berichten",
                  icon: <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
                },
                {
                  label: "Reacties geplaatst",
                  value: loading ? "…" : myApplications.length,
                  href: "#aanvragen",
                  icon: <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                  sub: loading ? null : recentApplicationsCount !== null
                    ? (recentApplicationsCount > 0 ? `+${recentApplicationsCount} in 30 dagen` : null)
                    : undefined,
                },
                {
                  label: "Opgeslagen zoekopdrachten",
                  value: loading ? "…" : savedSearchesCount,
                  href: "/opgeslagen-zoekopdrachten",
                  icon: <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
                },
              ].map((stat) => (
                <a key={stat.label} href={stat.href} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-black text-stone-900">{stat.value}</p>
                    {"sub" in stat && (
                      stat.sub === null
                        ? <span className="mt-0.5 block h-3 w-24 animate-pulse rounded-full bg-stone-100" />
                        : stat.sub !== undefined && (
                          <p className="mt-0.5 text-xs text-stone-400">{stat.sub}</p>
                        )
                    )}
                  </div>
                </a>
              ))}
            </div>

            <div id="aanvragen">
              <h2 className="mb-4 text-lg font-bold text-stone-900">Mijn aanvragen</h2>
              {loading ? (
                <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-stone-200" />)}</div>
              ) : myApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-50">
                    <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="mt-3 text-sm font-medium text-stone-700">Nog geen reacties geplaatst</p>
                  <p className="mt-1 text-xs text-stone-400">Reageer op woningen om jouw aanvragen hier te zien.</p>
                  <Link href="/kamers" className="mt-4 text-xs font-semibold text-rose-600 hover:underline">Woningen bekijken →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myApplications.map((app) => {
                    const badge = statusMap[app.status as keyof typeof statusMap] ?? statusMap.pending;
                    const conv = tenantConversations.find((c) => c.listing_id === app.listing_id);
                    return (
                      <div key={app.id} className="relative flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-5 pr-10 shadow-sm sm:flex-row sm:items-center">
                        {confirmDeleteTenantId === app.id && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm">
                            <p className="text-sm font-medium text-stone-800">Weet je zeker dat je deze aanvraag wilt verwijderen?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteTenantApplication(app.id)}
                                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95"
                              >
                                Ja, verwijderen
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTenantId(null)}
                                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label="Aanvraag verwijderen"
                          onClick={() => setConfirmDeleteTenantId(app.id)}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-500"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-stone-900 truncate">
                              {app.listings?.title ?? "Woning"}
                            </p>
                            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-stone-400">
                            {new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                            {app.budget != null && <span className="ml-2">· Budget: €{Number(app.budget).toFixed(0)}</span>}
                          </p>
                          <p className="mt-1.5 text-xs text-stone-500 line-clamp-1">{app.message}</p>
                          {app.landlord_reply && (
                            <div className="mt-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Bericht van verhuurder</p>
                              <p className="mt-0.5 text-xs text-stone-700">{app.landlord_reply}</p>
                            </div>
                          )}
                        </div>
                        {app.status === "accepted" && conv && (
                          <Link
                            href={`/berichten/${conv.id}`}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Ga naar gesprek
                          </Link>
                        )}
                        {app.listings?.id && (
                          <Link
                            href={`/kamers/${app.listings.id}`}
                            className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                          >
                            Bekijk woning →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-stone-900">Recent bekeken</h2>
                {!loading && recentViews.length > 0 && !confirmClearViews && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearViews(true)}
                    className="text-xs font-medium text-stone-400 transition hover:text-rose-500"
                  >
                    Alles wissen
                  </button>
                )}
                {confirmClearViews && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
                    <p className="text-xs font-medium text-rose-800">
                      Weet je zeker dat je je recent bekeken geschiedenis wilt wissen?
                    </p>
                    <button
                      type="button"
                      disabled={clearingViews}
                      onClick={async () => {
                        if (!supabase || !user) return;
                        setClearingViews(true);
                        const { error } = await supabase.from("listing_views").delete().eq("user_id", user.id);
                        setClearingViews(false);
                        if (error) {
                          toast.error("Wissen mislukt. Probeer het opnieuw.");
                        } else {
                          setRecentViews([]);
                          setConfirmClearViews(false);
                          toast.success("Recent bekeken geschiedenis gewist.");
                        }
                      }}
                      className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
                    >
                      {clearingViews ? "Bezig…" : "Ja, wissen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearViews(false)}
                      className="shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95"
                    >
                      Annuleren
                    </button>
                  </div>
                )}
              </div>
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="animate-pulse rounded-2xl bg-stone-200 h-36" />
                  ))}
                </div>
              ) : recentViews.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-50">
                    <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
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
                      <Link
                        key={v.listing_id}
                        href={`/kamers/${l.id}`}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                          {thumb ? (
                            <img src={thumb} alt={l.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <svg className="h-8 w-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                          )}
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

            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900">Snel navigeren</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/kamers" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Zoek woningen
                </Link>
                <Link href="/favorieten" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  Mijn favorieten
                </Link>
                <Link href="/berichten" className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Mijn berichten
                </Link>
              </div>
            </div>
          </div>
        )}

        {effectiveTab === "verhuur" && (
          <div className="mt-6 space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Actieve advertenties",
                  value: loading ? "…" : myListings.length,
                  href: "#listings",
                  icon: <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
                },
                {
                  label: "Gesprekken als verhuurder",
                  value: loading ? "…" : landlordConvsCount,
                  href: "/berichten",
                  icon: <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
                },
                {
                  label: "Openstaande aanvragen",
                  value: loading ? "…" : pendingCount,
                  href: "#aanvragen",
                  icon: <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
                  sub: loading ? null : recentLandlordApplicationsCount !== null
                    ? (recentLandlordApplicationsCount > 0 ? `+${recentLandlordApplicationsCount} in 30 dagen` : null)
                    : undefined,
                },
              ].map((stat) => (
                <a key={stat.label} href={stat.href} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-black text-stone-900">{stat.value}</p>
                    {"sub" in stat && (
                      stat.sub === null
                        ? <span className="mt-0.5 block h-3 w-24 animate-pulse rounded-full bg-stone-100" />
                        : stat.sub !== undefined && (
                          <p className="mt-0.5 text-xs text-stone-400">{stat.sub}</p>
                        )
                    )}
                  </div>
                </a>
              ))}
            </div>

            {/* ── Reactietijd insight — verhuurder only ── */}
            {!loading && profile?.user_type === "verhuurder" && (
              <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Mijn reactietijd</p>
                  <p className="mt-1 text-2xl font-black text-stone-900">
                    {profile.avg_response_time_hours != null
                      ? profile.avg_response_time_hours < 1
                        ? "< 1 uur"
                        : `${Math.round(profile.avg_response_time_hours)} uur`
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-blue-600">
                    Reageer binnen 1 uur voor meer vertrouwen bij huurders.
                  </p>
                </div>
              </div>
            )}

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
                    <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
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
                    const conv = landlordConversations.find(
                      (c) => c.listing_id === app.listing_id && c.tenant_id === app.applicant_id
                    );
                    return (
                      <div key={app.id} className="relative flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 pr-10 shadow-sm sm:flex-row sm:items-start">
                        {confirmDeleteId === app.id && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/95 p-4 text-center backdrop-blur-sm">
                            <p className="text-sm font-medium text-stone-800">Weet je zeker dat je deze aanvraag wilt verwijderen?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteApplication(app.id)}
                                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 active:scale-95"
                              >
                                Ja, verwijderen
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-50 active:scale-95"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label="Aanvraag verwijderen"
                          onClick={() => setConfirmDeleteId(app.id)}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-stone-300 transition hover:bg-stone-100 hover:text-stone-500"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                          {app.profiles?.avatar_url ? (
                            <img src={app.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-stone-500">{avatarInitial}</span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectedApplicantId(app.applicant_id); setSelectedApplicationId(app.id); }}
                              className="text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline"
                            >
                              {name}
                            </button>
                            {isApplicantVerified && (
                              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Geverifieerd
                              </span>
                            )}
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {app.listings?.title && (
                            <p className="text-xs text-stone-500">
                              <span className="font-medium text-stone-600">Advertentie:</span> {app.listings.title}
                            </p>
                          )}
                          <p className="text-sm text-stone-600 line-clamp-2">{app.message}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                            {app.budget != null && (
                              <span className="font-medium text-stone-600">Budget: €{Number(app.budget).toFixed(0)}</span>
                            )}
                            <span>{new Date(app.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {app.status === "accepted" && conv && (
                            <Link
                              href={`/berichten/${conv.id}`}
                              className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                            >
                              Gesprek →
                            </Link>
                          )}
                          {app.status === "pending" && inlineReply?.appId !== app.id && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setInlineReply({ appId: app.id, action: "accepted", text: "" })}
                                className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-95"
                              >
                                Accepteren
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineReply({ appId: app.id, action: "rejected", text: "" })}
                                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 active:scale-95"
                              >
                                Afwijzen
                              </button>
                            </div>
                          )}
                          {app.status === "pending" && inlineReply?.appId === app.id && (
                            <div className="w-full min-w-[220px] rounded-2xl border border-stone-200 bg-stone-50 p-3 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                Optioneel: stuur een bericht met je beslissing
                              </p>
                              <textarea
                                rows={3}
                                maxLength={300}
                                placeholder="Schrijf een bericht..."
                                value={inlineReply.text}
                                onChange={(e) => setInlineReply((r) => r ? { ...r, text: e.target.value } : r)}
                                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleApplicationStatus(app.id, inlineReply.action, inlineReply.text)}
                                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white transition active:scale-95 ${
                                    inlineReply.action === "accepted"
                                      ? "bg-emerald-500 hover:bg-emerald-600"
                                      : "bg-stone-500 hover:bg-stone-600"
                                  }`}
                                >
                                  {inlineReply.action === "accepted"
                                    ? (inlineReply.text.trim() ? "Accepteren en bericht versturen" : "Accepteren")
                                    : (inlineReply.text.trim() ? "Afwijzen en bericht versturen" : "Afwijzen")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineReply(null)}
                                  className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100"
                                >
                                  Annuleren
                                </button>
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

            <div id="listings">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-stone-900">Mijn advertenties</h2>
                <Link href="/kamers/nieuw" className="text-sm font-medium text-rose-600 hover:underline">+ Nieuwe advertentie</Link>
              </div>
              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map((n) => (
                    <div key={n} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                      <div className="aspect-[4/3] animate-pulse bg-stone-200" />
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="h-4 w-3/4 animate-pulse rounded-full bg-stone-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-stone-200" />
                        <div className="mt-auto h-5 w-1/3 animate-pulse rounded-full bg-stone-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : myListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                    <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-stone-800">Nog geen advertenties</h3>
                  <p className="mt-2 max-w-sm text-sm text-stone-500">Plaats je eerste advertentie en bereik duizenden huurders.</p>
                  <Link href="/kamers/nieuw" className="mt-6 rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Advertentie plaatsen</Link>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {myListings.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      isFavorited={false}
                      verificationBadge={
                        profile?.email_auto_verified && profile?.phone_verified ? "Geverifieerd" : null
                      }
                      avgResponseTimeHours={profile?.avg_response_time_hours ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
