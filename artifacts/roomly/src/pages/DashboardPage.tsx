import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ListingCard } from "@/components/listings/ListingCard";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import type { Listing, Profile, ApplicationWithDetails } from "@/types/database";

type Tab = "zoektocht" | "verhuur";

type MyApplication = {
  id: string;
  listing_id: string;
  applicant_id: string;
  message: string;
  budget: number | null;
  status: string;
  created_at: string;
  listings: { id: string; title: string } | null;
};

type ConvSummary = { id: string; listing_id: string; tenant_id: string };

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("zoektocht");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);

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
      ] = await Promise.all([
        supabase!.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase!.from("listings").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase!.from("favorites").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase!.from("conversations").select("*", { count: "exact", head: true }).eq("tenant_id", user!.id),
        supabase!.from("conversations").select("*", { count: "exact", head: true }).eq("landlord_id", user!.id),
        supabase!.from("applications").select("*, listings:listing_id(id, title)").eq("applicant_id", user!.id).order("created_at", { ascending: false }),
        supabase!.from("conversations").select("id, listing_id, tenant_id").eq("tenant_id", user!.id),
      ]);

      setProfile(p as Profile | null);
      setFavoritesCount(favCount ?? 0);
      setTenantConvsCount(tenantConvCount ?? 0);
      setLandlordConvsCount(landlordConvCount ?? 0);
      setMyApplications((myApps as MyApplication[] | null) ?? []);
      setTenantConversations((tenantConvData as ConvSummary[] | null) ?? []);

      const listings = (ls as Listing[] | null) ?? [];
      setMyListings(listings);

      if (listings.length > 0) {
        const listingIds = listings.map((l) => l.id);
        const [{ data: apps }, { data: landlordConvData }] = await Promise.all([
          supabase!
            .from("applications")
            .select("*, profiles:applicant_id(name, email, avatar_url), listings:listing_id(title)")
            .in("listing_id", listingIds)
            .order("created_at", { ascending: false }),
          supabase!
            .from("conversations")
            .select("id, listing_id, tenant_id")
            .in("listing_id", listingIds),
        ]);
        setReceivedApplications((apps as ApplicationWithDetails[] | null) ?? []);
        setLandlordConversations((landlordConvData as ConvSummary[] | null) ?? []);
      }

      setLoading(false);
    }
    fetchData();
  }, [user, authLoading]);

  async function handleApplicationStatus(appId: string, status: "accepted" | "rejected") {
    if (!supabase || !user) return;
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) {
      toast.error("Er ging iets mis, probeer opnieuw.");
      return;
    }

    const app = receivedApplications.find((a) => a.id === appId);
    let convId: string | null = null;

    if (status === "accepted" && app) {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id, listing_id, tenant_id")
        .eq("listing_id", app.listing_id)
        .eq("tenant_id", app.applicant_id)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
        setLandlordConversations((prev) => {
          if (prev.find((c) => c.id === existing.id)) return prev;
          return [...prev, existing as ConvSummary];
        });
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ listing_id: app.listing_id, tenant_id: app.applicant_id, landlord_id: user.id })
          .select("id, listing_id, tenant_id")
          .single();
        if (created) {
          convId = created.id;
          setLandlordConversations((prev) => [...prev, created as ConvSummary]);
        }
      }
    }

    if (app) {
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: app.applicant_id,
        type: status === "accepted" ? "application_accepted" : "application_rejected",
        title: status === "accepted" ? "Aanvraag geaccepteerd!" : "Aanvraag afgewezen",
        body:
          status === "accepted"
            ? `Je aanvraag voor "${app.listings?.title ?? "een woning"}" is geaccepteerd. Je kunt nu het gesprek bekijken.`
            : `Je aanvraag voor "${app.listings?.title ?? "een woning"}" is helaas niet doorgegaan.`,
        related_id: status === "accepted" ? convId : null,
        read: false,
      });
      if (notifErr) {
        console.error("[DashboardPage] notification insert failed — is the notifications table created in Supabase?", notifErr);
      }
    }

    setReceivedApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, status } : a))
    );
    toast.success(
      status === "accepted"
        ? "Aanvraag geaccepteerd. Er is een gesprek aangemaakt."
        : "Aanvraag afgewezen."
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Log in om je dashboard te bekijken</h1>
        <Link href="/inloggen" data-testid="dashboard-login-link" className="mt-6 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-600">Inloggen</Link>
      </div>
    );
  }

  const initial = (profile?.name ?? profile?.email ?? user?.email ?? "?").slice(0, 1).toUpperCase();
  const pendingCount = receivedApplications.filter((a) => a.status === "pending").length;

  const statusMap = {
    pending: { label: "In behandeling", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    accepted: { label: "Geaccepteerd", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected: { label: "Afgewezen", cls: "bg-stone-100 text-stone-500 border-stone-200" },
  };

  return (
    <>
      <ApplicantProfilePanel
        applicantId={selectedApplicantId}
        onClose={() => setSelectedApplicantId(null)}
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
            <Link href="/kamers/nieuw" className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-95" data-testid="dashboard-new-listing">
              + Advertentie plaatsen
            </Link>
          </div>
        </div>

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

        {activeTab === "zoektocht" && (
          <div className="mt-6 space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
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
                },
              ].map((stat) => (
                <a key={stat.label} href={stat.href} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-black text-stone-900">{stat.value}</p>
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
                      <div key={app.id} className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
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

        {activeTab === "verhuur" && (
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
                },
              ].map((stat) => (
                <a key={stat.label} href={stat.href} className="flex items-center gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-50">{stat.icon}</div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">{stat.label}</p>
                    <p className="text-2xl font-black text-stone-900">{stat.value}</p>
                  </div>
                </a>
              ))}
            </div>

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
                    const conv = landlordConversations.find(
                      (c) => c.listing_id === app.listing_id && c.tenant_id === app.applicant_id
                    );
                    return (
                      <div key={app.id} className="flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-start">
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
                              onClick={() => setSelectedApplicantId(app.applicant_id)}
                              className="text-sm font-semibold text-stone-900 transition hover:text-rose-600 hover:underline"
                            >
                              {name}
                            </button>
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
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {app.status === "accepted" && conv && (
                            <Link
                              href={`/berichten/${conv.id}`}
                              className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                            >
                              Gesprek →
                            </Link>
                          )}
                          {app.status === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApplicationStatus(app.id, "accepted")}
                                className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 active:scale-95"
                              >
                                Accepteren
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplicationStatus(app.id, "rejected")}
                                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 active:scale-95"
                              >
                                Afwijzen
                              </button>
                            </>
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
                    <ListingCard key={l.id} listing={l} isFavorited={false} />
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
