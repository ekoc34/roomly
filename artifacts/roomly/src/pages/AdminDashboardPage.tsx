/**
 * Admin Dashboard — Welkthuis.nl Operations Cockpit
 *
 * Access is restricted to users with role = 'admin'.
 * Admin privileges are NEVER assigned automatically. The only way to promote
 * a user to admin is by running the following SQL in the Supabase SQL Editor:
 *
 *   UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL';
 *
 * No other code path in this application sets role = 'admin'.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  ShieldCheck, AlertTriangle, Trash2, RotateCcw, Users, FileWarning,
  Home, Mail, CheckCheck, MessageSquareWarning, Search, Zap, Building2,
  CreditCard, Activity, ChevronDown, Star, UserCog, Plus, ShieldOff, EyeOff, Sprout,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ApplicantProfilePanel } from "@/components/dashboard/ApplicantProfilePanel";
import { AdminModerationTab } from "@/components/admin/AdminModerationTab";
import { AdminSeedTab } from "@/components/admin/AdminSeedTab";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "meldingen" | "moderatie" | "gebruikers" | "advertenties" | "betalingen" | "activiteit" | "seeding";

type FlaggedLandlord = {
  id: string; name: string | null; email: string | null;
  avatar_url: string | null; scam_count: number; latest_report: string | null;
};
type ScamReport = {
  id: string; reason: string; created_at: string; listing_id: string;
  listing_title: string; landlord_name: string | null; reporter_name: string | null;
};
type ContactMessage = {
  id: string; name: string; email: string; category: string;
  subject: string; message: string; is_read: boolean; created_at: string;
};
type UserReportRow = {
  id: string; reason: string; resolved: boolean; created_at: string;
  reporter_name: string | null; reported_name: string | null; reported_id: string | null;
};
type Stats = {
  flaggedCount: number; scamReportCount: number; totalListings: number;
  unreadContactCount: number; userReportCount: number;
};
type AdminUser = {
  id: string; name: string | null; email: string | null; avatar_url: string | null;
  role: string; user_type: string | null; subscription_tier: string;
  email_auto_verified: boolean; phone_verified: boolean;
  boost_credits: number; suspended_until: string | null; ban_reason: string | null; created_at: string;
};
type AdminListing = {
  id: string; title: string; price: number; location: string;
  type: string; boosted_at: string | null; hidden: boolean; created_at: string;
  owner_name: string | null; owner_scam_flagged: boolean;
};
type BoostLogRow = {
  id: string; user_name: string | null; listing_title: string | null;
  action: string; credits_used: number;
  credit_before: number | null; credit_after: number | null; created_at: string;
};
type ActivityEntry = {
  id: string; source: "admin" | "boost"; actor_name: string | null;
  action: string; target_type: string | null; target_id: string | null;
  details: Record<string, unknown> | null; listing_title?: string | null;
  credits_used?: number | null; credit_before?: number | null; credit_after?: number | null;
  created_at: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const USER_TYPE_LABELS: Record<string, string> = {
  verhuurder: "Verhuurder", huisgenoot_zoeker: "Huisgenoot zoeker",
  student: "Student", professional: "Professional",
  alleenstaande: "Alleenstaande", family: "Familie",
};
const USER_TYPE_OPTIONS = Object.entries(USER_TYPE_LABELS);

const LISTING_TYPE_LABELS: Record<string, string> = {
  room_for_rent: "Kamer", roommate_search: "Huisgenoot", short_stay: "Kort verblijf",
};

const CATEGORY_STYLES: Record<string, string> = {
  suggestie: "bg-emerald-100 text-emerald-700 border-emerald-200",
  klacht: "bg-rose-100 text-rose-700 border-rose-200",
  vraag: "bg-blue-100 text-blue-700 border-blue-200",
  overig: "bg-stone-100 text-stone-600 border-stone-200",
};
const CATEGORY_LABELS: Record<string, string> = {
  suggestie: "Suggestie", klacht: "Klacht", vraag: "Vraag", overig: "Overig",
};

function reasonBadgeClass(r: string) {
  return r === "blocked" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
}
function reasonLabel(r: string) {
  return r === "blocked" ? "Geblokkeerd" : r;
}

const BOOST_ACTIVE_MS = 60 * 60 * 1000;
function isBoostActive(boostedAt: string | null): boolean {
  if (!boostedAt) return false;
  return new Date(boostedAt) > new Date(Date.now() - BOOST_ACTIVE_MS);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: number }) {
  return (
    <div className={`flex items-center gap-4 rounded-2xl border p-5 ${bg}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
        <p className="text-xs text-stone-600">{label}</p>
      </div>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200">
      {url
        ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <span className="text-sm font-semibold text-stone-500">{(name ?? "?").charAt(0).toUpperCase()}</span>
      }
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white px-6 py-10 text-center text-sm text-stone-400 shadow-sm">
      {text}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">{children}</th>;
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();

  // Auth
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>("meldingen");
  const loadedTabs = useRef<Set<Tab>>(new Set());

  // Meldingen
  const [landlords, setLandlords] = useState<FlaggedLandlord[]>([]);
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [userReports, setUserReports] = useState<UserReportRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [profilePanelId, setProfilePanelId] = useState<string | null>(null);

  // Gebruikers
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("alle");
  const [userVerifFilter, setUserVerifFilter] = useState("alle");
  const [editingUserType, setEditingUserType] = useState<Record<string, string>>({});

  // Advertenties
  const [adminListings, setAdminListings] = useState<AdminListing[]>([]);
  const [moderationPendingCount, setModerationPendingCount] = useState(0);
  const [listingSearch, setListingSearch] = useState("");
  const [listingFilter, setListingFilter] = useState("alle");

  // Betalingen
  const [boostLogs, setBoostLogs] = useState<BoostLogRow[]>([]);
  const [boostStats, setBoostStats] = useState<{ total: number; today: number } | null>(null);

  // Activiteit
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityTypeFilter, setActivityTypeFilter] = useState("alle");
  const [activityDateFilter, setActivityDateFilter] = useState("");

  // ── Auth ────────────────────────────────────────────────────────────────
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

  // ── Data loaders ────────────────────────────────────────────────────────

  async function loadMeldingen() {
    if (!supabase) return;
    const { data: flaggedProfiles } = await supabase
      .from("profiles").select("id, name, email, avatar_url").eq("scam_flagged", true);
    if (flaggedProfiles && flaggedProfiles.length > 0) {
      const enriched: FlaggedLandlord[] = await Promise.all(
        (flaggedProfiles as { id: string; name: string | null; email: string | null; avatar_url: string | null }[]).map(async (p) => {
          const { data: repData } = await supabase!
            .from("listing_reports").select("created_at, listings!inner(user_id)")
            .eq("category", "scam").eq("listings.user_id", p.id)
            .order("created_at", { ascending: false });
          const rows = (repData ?? []) as { created_at: string }[];
          return { ...p, scam_count: rows.length, latest_report: rows[0]?.created_at ?? null };
        })
      );
      setLandlords(enriched);
    } else setLandlords([]);

    const { data: repRows } = await supabase.from("listing_reports")
      .select("id, reason, created_at, listing_id, listings ( title, profiles ( name ) ), profiles ( name )")
      .eq("category", "scam").order("created_at", { ascending: false });
    if (repRows) {
      setReports((repRows as {
        id: string; reason: string; created_at: string; listing_id: string;
        listings: { title: string; profiles: { name: string | null } | null } | null;
        profiles: { name: string | null } | null;
      }[]).map((r) => ({
        id: r.id, reason: r.reason, created_at: r.created_at, listing_id: r.listing_id,
        listing_title: r.listings?.title ?? "—",
        landlord_name: r.listings?.profiles?.name ?? null,
        reporter_name: r.profiles?.name ?? null,
      })));
    }

    const { data: contactRows } = await supabase.from("contact_messages")
      .select("id, name, email, category, subject, message, is_read, created_at")
      .order("created_at", { ascending: false });
    if (contactRows) setContactMessages(contactRows as ContactMessage[]);

    const { data: urRows } = await supabase.from("user_reports")
      .select("id, reason, resolved, created_at, reported_id, reporter:reporter_id ( name ), reported:reported_id ( name )")
      .eq("resolved", false).order("created_at", { ascending: false });
    if (urRows) {
      setUserReports((urRows as {
        id: string; reason: string; resolved: boolean; created_at: string;
        reported_id: string | null; reporter: { name: string | null } | null;
        reported: { name: string | null } | null;
      }[]).map((r) => ({
        id: r.id, reason: r.reason, resolved: r.resolved, created_at: r.created_at,
        reporter_name: r.reporter?.name ?? null, reported_name: r.reported?.name ?? null,
        reported_id: r.reported_id ?? null,
      })));
    }

    const [
      { count: flaggedCount }, { count: scamCount }, { count: listingsCount },
      { count: unreadContact }, { count: userReportCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("scam_flagged", true),
      supabase.from("listing_reports").select("*", { count: "exact", head: true }).eq("category", "scam"),
      supabase.from("listings").select("*", { count: "exact", head: true }),
      supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("is_read", false),
      supabase.from("user_reports").select("*", { count: "exact", head: true }).eq("resolved", false),
    ]);
    setStats({
      flaggedCount: flaggedCount ?? 0, scamReportCount: scamCount ?? 0,
      totalListings: listingsCount ?? 0, unreadContactCount: unreadContact ?? 0,
      userReportCount: userReportCount ?? 0,
    });
  }

  async function loadUsers() {
    if (!supabase) return;
    const { data } = await supabase.from("profiles")
      .select("id, name, email, avatar_url, role, user_type, subscription_tier, email_auto_verified, phone_verified, boost_credits, suspended_until, ban_reason, created_at")
      .order("created_at", { ascending: false });
    if (data) setAdminUsers(data as AdminUser[]);
  }

  async function loadListings() {
    if (!supabase) return;
    const { data } = await supabase.from("listings")
      .select("id, title, price, location, type, boosted_at, hidden, created_at, profiles ( name, scam_flagged )")
      .order("created_at", { ascending: false });
    if (data) {
      setAdminListings((data as unknown as {
        id: string; title: string; price: number; location: string; type: string;
        boosted_at: string | null; hidden: boolean; created_at: string;
        profiles: { name: string | null; scam_flagged: boolean } | null;
      }[]).map((l) => ({
        id: l.id, title: l.title, price: l.price, location: l.location,
        type: l.type, boosted_at: l.boosted_at, hidden: l.hidden ?? false, created_at: l.created_at,
        owner_name: l.profiles?.name ?? null,
        owner_scam_flagged: l.profiles?.scam_flagged ?? false,
      })));
    }
  }

  async function loadBoostLogs() {
    if (!supabase) return;
    const { data } = await supabase.from("boost_logs")
      .select("id, action, credits_used, credit_before, credit_after, created_at, profiles ( name ), listings ( title )")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) {
      const rows = (data as {
        id: string; action: string; credits_used: number;
        credit_before: number | null; credit_after: number | null; created_at: string;
        profiles: { name: string | null } | null;
        listings: { title: string } | null;
      }[]).map((r) => ({
        id: r.id, action: r.action, credits_used: r.credits_used,
        credit_before: r.credit_before, credit_after: r.credit_after,
        created_at: r.created_at,
        user_name: r.profiles?.name ?? null,
        listing_title: r.listings?.title ?? null,
      }));
      setBoostLogs(rows);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      setBoostStats({
        total: rows.reduce((s, r) => s + r.credits_used, 0),
        today: rows.filter((r) => new Date(r.created_at) >= todayStart).length,
      });
    }
  }

  async function loadActivity() {
    if (!supabase) return;
    const [{ data: adminRows }, { data: boostRows }] = await Promise.all([
      supabase.from("admin_actions")
        .select("id, action, target_type, target_id, details, created_at, profiles ( name )")
        .order("created_at", { ascending: false }).limit(300),
      supabase.from("boost_logs")
        .select("id, action, credits_used, credit_before, credit_after, created_at, profiles ( name ), listings ( title )")
        .order("created_at", { ascending: false }).limit(300),
    ]);

    const entries: ActivityEntry[] = [];

    for (const r of (adminRows ?? []) as {
      id: string; action: string; target_type: string; target_id: string | null;
      details: Record<string, unknown> | null; created_at: string;
      profiles: { name: string | null } | null;
    }[]) {
      entries.push({
        id: r.id, source: "admin", actor_name: r.profiles?.name ?? null,
        action: r.action, target_type: r.target_type, target_id: r.target_id,
        details: r.details, created_at: r.created_at,
      });
    }

    for (const r of (boostRows ?? []) as {
      id: string; action: string; credits_used: number;
      credit_before: number | null; credit_after: number | null; created_at: string;
      profiles: { name: string | null } | null;
      listings: { title: string } | null;
    }[]) {
      entries.push({
        id: r.id, source: "boost", actor_name: r.profiles?.name ?? null,
        action: "boost_listing", target_type: "listing", target_id: null,
        details: null, listing_title: r.listings?.title ?? null,
        credits_used: r.credits_used, credit_before: r.credit_before,
        credit_after: r.credit_after, created_at: r.created_at,
      });
    }

    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivityLog(entries);
  }

  // ── Tab activation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (role !== "admin") return;
    if (loadedTabs.current.has(activeTab)) return;
    loadedTabs.current.add(activeTab);
    if (activeTab === "meldingen") loadMeldingen();
    else if (activeTab === "gebruikers") loadUsers();
    else if (activeTab === "advertenties") loadListings();
    else if (activeTab === "betalingen") loadBoostLogs();
    else if (activeTab === "activiteit") loadActivity();
  }, [activeTab, role]);

  // ── Realtime badge subscriptions ─────────────────────────────────────────
  // Four channels keep the Meldingen badge count live for admins.
  // When a new scam report, user report, contact message, or flagged profile
  // arrives the badge increments instantly — no page refresh needed.
  const realtimeChannelsRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]>[]>([]);

  useEffect(() => {
    if (role !== "admin" || !supabase) return;

    // Tear down any stale channels first
    realtimeChannelsRef.current.forEach((ch) => supabase!.removeChannel(ch));
    realtimeChannelsRef.current = [];

    const ts = Date.now();

    // 1. Scam reports (listing_reports INSERT where category = 'scam')
    const scamCh = supabase
      .channel(`admin-scam-reports:${ts}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listing_reports" },
        (payload) => {
          if ((payload.new as { category?: string }).category === "scam") {
            setStats((s) => s ? { ...s, scamReportCount: s.scamReportCount + 1 } : s);
            // Reload list data if the meldingen tab has already been fetched
            if (loadedTabs.current.has("meldingen")) {
              loadedTabs.current.delete("meldingen");
              loadMeldingen().then(() => loadedTabs.current.add("meldingen"));
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[admin-rt] scam-reports channel error");
      });

    // 2. User reports (user_reports INSERT)
    const userRepCh = supabase
      .channel(`admin-user-reports:${ts}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_reports" },
        () => {
          setStats((s) => s ? { ...s, userReportCount: s.userReportCount + 1 } : s);
          if (loadedTabs.current.has("meldingen")) {
            loadedTabs.current.delete("meldingen");
            loadMeldingen().then(() => loadedTabs.current.add("meldingen"));
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[admin-rt] user-reports channel error");
      });

    // 3. Contact messages (contact_messages INSERT)
    const contactCh = supabase
      .channel(`admin-contact-messages:${ts}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contact_messages" },
        () => {
          setStats((s) => s ? { ...s, unreadContactCount: s.unreadContactCount + 1 } : s);
          if (loadedTabs.current.has("meldingen")) {
            loadedTabs.current.delete("meldingen");
            loadMeldingen().then(() => loadedTabs.current.add("meldingen"));
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[admin-rt] contact-messages channel error");
      });

    // 4. Flagged/unflagged landlords (profiles UPDATE on scam_flagged)
    const profileCh = supabase
      .channel(`admin-profiles-flagged:${ts}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const newRow = payload.new as { scam_flagged?: boolean };
          const oldRow = payload.old as { scam_flagged?: boolean };
          if (newRow.scam_flagged && !oldRow.scam_flagged) {
            setStats((s) => s ? { ...s, flaggedCount: s.flaggedCount + 1 } : s);
            if (loadedTabs.current.has("meldingen")) {
              loadedTabs.current.delete("meldingen");
              loadMeldingen().then(() => loadedTabs.current.add("meldingen"));
            }
          } else if (!newRow.scam_flagged && oldRow.scam_flagged) {
            setStats((s) => s ? { ...s, flaggedCount: Math.max(0, s.flaggedCount - 1) } : s);
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[admin-rt] profiles channel error");
      });

    realtimeChannelsRef.current = [scamCh, userRepCh, contactCh, profileCh];

    return () => {
      realtimeChannelsRef.current.forEach((ch) => supabase!.removeChannel(ch));
      realtimeChannelsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ── Meldingen actions ────────────────────────────────────────────────────
  const handleRestore = (landlordId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { data: prof } = await supabase.from("profiles")
        .select("email_auto_verified, phone_verified").eq("id", landlordId).maybeSingle();
      const { error } = await supabase.from("profiles").update({ scam_flagged: false }).eq("id", landlordId);
      if (error) { toast.error("Herstellen mislukt."); return; }
      if (prof && !prof.email_auto_verified && !prof.phone_verified)
        await supabase.from("profiles").update({ email_auto_verified: true, phone_verified: true }).eq("id", landlordId);
      const { data: theirListings } = await supabase.from("listings").select("id").eq("user_id", landlordId);
      if (theirListings?.length) {
        await supabase.from("listing_reports").delete()
          .in("listing_id", (theirListings as { id: string }[]).map((l) => l.id)).eq("category", "scam");
      }
      await supabase.rpc("log_admin_action", { p_action: "restore_landlord", p_target_type: "user", p_target_id: landlordId });
      toast.success("Verhuurder hersteld.");
      loadedTabs.current.delete("meldingen"); loadMeldingen();
    });
  };
  const handleIgnoreReport = (reportId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.from("listing_reports").delete().eq("id", reportId);
      if (error) { toast.error("Verwijderen mislukt."); return; }
      toast.success("Rapport verwijderd.");
      setReports((p) => p.filter((r) => r.id !== reportId));
      setStats((s) => s ? { ...s, scamReportCount: Math.max(0, s.scamReportCount - 1) } : s);
    });
  };
  const handleDismissUserReport = (reportId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.from("user_reports").update({ resolved: true }).eq("id", reportId);
      if (error) { toast.error("Bijwerken mislukt."); return; }
      toast.success("Melding afgehandeld.");
      setUserReports((p) => p.filter((r) => r.id !== reportId));
      setStats((s) => s ? { ...s, userReportCount: Math.max(0, s.userReportCount - 1) } : s);
    });
  };
  const handleMarkRead = (messageId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.from("contact_messages").update({ is_read: true }).eq("id", messageId);
      if (error) { toast.error("Bijwerken mislukt."); return; }
      setContactMessages((p) => p.map((m) => m.id === messageId ? { ...m, is_read: true } : m));
      setStats((s) => s ? { ...s, unreadContactCount: Math.max(0, s.unreadContactCount - 1) } : s);
    });
  };

  // ── Gebruikers actions ───────────────────────────────────────────────────
  const handleAddCredits = (userId: string, userName: string | null) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_add_boost_credits", { p_user_id: userId, p_credits: 10 });
      if (error) { toast.error("Credits toevoegen mislukt."); return; }
      await supabase.rpc("log_admin_action", { p_action: "add_credits", p_target_type: "user", p_target_id: userId, p_details: { amount: 10, user_name: userName } });
      toast.success(`10 credits toegevoegd aan ${userName ?? "gebruiker"}.`);
      setAdminUsers((p) => p.map((u) => u.id === userId ? { ...u, boost_credits: u.boost_credits + 10 } : u));
    });
  };
  const handleSetUserType = (userId: string, newType: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_set_user_type", { p_user_id: userId, p_user_type: newType });
      if (error) { toast.error("Rol wijzigen mislukt."); return; }
      await supabase.rpc("log_admin_action", { p_action: "set_user_type", p_target_type: "user", p_target_id: userId, p_details: { new_type: newType } });
      toast.success("Rol bijgewerkt.");
      setAdminUsers((p) => p.map((u) => u.id === userId ? { ...u, user_type: newType } : u));
      setEditingUserType((p) => { const n = { ...p }; delete n[userId]; return n; });
    });
  };

  // ── Advertenties actions ─────────────────────────────────────────────────
  const handleAdminDeleteListing = (listingId: string, title: string) => {
    if (!confirm(`Advertentie "${title}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_delete_listing", { p_listing_id: listingId });
      if (error) { toast.error("Verwijderen mislukt."); return; }
      await supabase.rpc("log_admin_action", { p_action: "delete_listing", p_target_type: "listing", p_target_id: listingId, p_details: { title } });
      toast.success("Advertentie verwijderd.");
      setAdminListings((p) => p.filter((l) => l.id !== listingId));
    });
  };
  const handleAdminBoost = (listingId: string, title: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_boost_listing", { p_listing_id: listingId });
      if (error) { toast.error("Uitlichten mislukt."); return; }
      await supabase.rpc("log_admin_action", { p_action: "boost_listing", p_target_type: "listing", p_target_id: listingId, p_details: { title } });
      toast.success("Advertentie uitgelicht.");
      setAdminListings((p) => p.map((l) => l.id === listingId ? { ...l, boosted_at: new Date().toISOString() } : l));
    });
  };

  // ── Moderatie actions ────────────────────────────────────────────────────
  const handleHideListing = (listingId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_hide_listing", { p_listing_id: listingId, p_reason: "Verborgen door admin" });
      if (error) { toast.error("Verbergen mislukt."); return; }
      toast.success("Advertentie verborgen voor publiek.");
      setAdminListings((p) => p.map((l) => l.id === listingId ? { ...l, hidden: true } : l));
    });
  };
  const handleUnhideListing = (listingId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_unhide_listing", { p_listing_id: listingId });
      if (error) { toast.error("Herstellen mislukt."); return; }
      toast.success("Advertentie weer zichtbaar.");
      setAdminListings((p) => p.map((l) => l.id === listingId ? { ...l, hidden: false } : l));
    });
  };
  const handleSuspendUser = (userId: string, userName: string | null, days: number) => {
    if (!confirm(`${userName ?? "Gebruiker"} voor ${days} dagen schorsen?`)) return;
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_suspend_user", { p_user_id: userId, p_days: days, p_reason: null });
      if (error) {
        if (error.message?.includes("CANNOT")) toast.error("Je kunt geen admin schorsen.");
        else toast.error("Schorsen mislukt.");
        return;
      }
      const until = new Date(Date.now() + days * 86400000).toISOString();
      toast.success(`${userName ?? "Gebruiker"} geschorst voor ${days} dagen.`);
      setAdminUsers((p) => p.map((u) => u.id === userId ? { ...u, suspended_until: until } : u));
    });
  };
  const handleUnsuspendUser = (userId: string, userName: string | null) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_unsuspend_user", { p_user_id: userId });
      if (error) { toast.error("Herstellen mislukt."); return; }
      toast.success(`Schorsing van ${userName ?? "gebruiker"} opgeheven.`);
      setAdminUsers((p) => p.map((u) => u.id === userId ? { ...u, suspended_until: null, ban_reason: null } : u));
    });
  };
  const handleBanUser = (userId: string, userName: string | null) => {
    if (!confirm(`${userName ?? "Gebruiker"} permanent verbannen? Dit verbergt ook al hun advertenties.`)) return;
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_ban_user", { p_user_id: userId, p_reason: null });
      if (error) {
        if (error.message?.includes("CANNOT")) toast.error("Je kunt geen admin verbannen.");
        else toast.error("Verbannen mislukt.");
        return;
      }
      toast.success(`${userName ?? "Gebruiker"} permanent verbannen.`);
      setAdminUsers((p) => p.map((u) => u.id === userId ? { ...u, suspended_until: "9999-12-31T23:59:59+00:00" } : u));
    });
  };

  // ── Render guards ────────────────────────────────────────────────────────
  if (authLoading || roleLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" /></div>;
  }
  if (!user || role !== "admin") return null;

  // ── Derived / filtered data ──────────────────────────────────────────────
  const filteredUsers = adminUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchSearch = !q || (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    const matchRole = userRoleFilter === "alle" || u.user_type === userRoleFilter;
    const isVerified = u.email_auto_verified && u.phone_verified;
    const matchVerif = userVerifFilter === "alle" || (userVerifFilter === "geverifieerd" ? isVerified : !isVerified);
    return matchSearch && matchRole && matchVerif;
  });

  const filteredListings = adminListings.filter((l) => {
    const q = listingSearch.toLowerCase();
    const matchSearch = !q || l.title.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || (l.owner_name ?? "").toLowerCase().includes(q);
    const matchFilter = listingFilter === "alle" || (listingFilter === "uitgelicht" ? isBoostActive(l.boosted_at) : listingFilter === "verborgen" ? l.hidden : l.owner_scam_flagged);
    return matchSearch && matchFilter;
  });

  const filteredActivity = activityLog.filter((e) => {
    const matchType = activityTypeFilter === "alle" || (activityTypeFilter === "admin" ? e.source === "admin" : e.source === "boost");
    const matchDate = !activityDateFilter || e.created_at.startsWith(activityDateFilter);
    return matchType && matchDate;
  });

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "meldingen", label: "Meldingen", icon: <AlertTriangle className="h-4 w-4" />, badge: stats ? stats.flaggedCount + stats.scamReportCount + stats.unreadContactCount + stats.userReportCount : undefined },
    { id: "moderatie", label: "Moderatie", icon: <ShieldOff className="h-4 w-4" />, badge: moderationPendingCount > 0 ? moderationPendingCount : undefined },
    { id: "gebruikers", label: "Gebruikers", icon: <Users className="h-4 w-4" /> },
    { id: "advertenties", label: "Advertenties", icon: <Building2 className="h-4 w-4" /> },
    { id: "betalingen", label: "Betalingen", icon: <CreditCard className="h-4 w-4" /> },
    { id: "activiteit", label: "Activiteit", icon: <Activity className="h-4 w-4" /> },
    { id: "seeding", label: "Demo-inhoud", icon: <Sprout className="h-4 w-4" /> },
  ];

  const inputCls = "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
  const selectCls = "rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200";
  const actionBtnCls = "flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 active:scale-95";
  const successBtnCls = "flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 active:scale-95";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {profilePanelId && (
        <ApplicantProfilePanel profileId={profilePanelId} mode="applicant" viewerUserId={user?.id} onClose={() => setProfilePanelId(null)} />
      )}

      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Admin Dashboard</span>
      </nav>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100">
            <ShieldCheck className="h-5 w-5 text-rose-600" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
            <p className="text-sm text-stone-500">Operations cockpit — Welkthuis.nl</p>
          </div>
        </div>
        <Link
          href="/admin/analytics"
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <Activity className="h-3.5 w-3.5" />
          Analytics
        </Link>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-2xl bg-stone-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === t.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: MELDINGEN                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "meldingen" && (
        <div>
          {stats && (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} bg="bg-amber-50 border-amber-200" label="Gemarkeerde verhuurders" value={stats.flaggedCount} />
              <StatCard icon={<FileWarning className="h-5 w-5 text-rose-500" />} bg="bg-rose-50 border-rose-200" label="Scam-meldingen" value={stats.scamReportCount} />
              <StatCard icon={<Mail className="h-5 w-5 text-blue-500" />} bg="bg-blue-50 border-blue-200" label="Ongelezen berichten" value={stats.unreadContactCount} />
              <StatCard icon={<MessageSquareWarning className="h-5 w-5 text-violet-500" />} bg="bg-violet-50 border-violet-200" label="Gebruikersmeldingen" value={stats.userReportCount} />
            </div>
          )}

          {/* Flagged landlords */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Gemarkeerde verhuurders
              {landlords.length > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{landlords.length}</span>}
            </h2>
            {landlords.length === 0 ? <EmptyState text="Geen gemarkeerde verhuurders gevonden." /> : (
              <div className="space-y-3">
                {landlords.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Avatar url={l.avatar_url} name={l.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">{l.name ?? "Naamloos"}</p>
                        <p className="truncate text-xs text-stone-500">{l.email ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-rose-600">{l.scam_count}</p>
                        <p className="text-xs text-stone-500">scam-meldingen</p>
                      </div>
                      {l.latest_report && (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-stone-700">{fmtDate(l.latest_report)}</p>
                          <p className="text-xs text-stone-500">laatste melding</p>
                        </div>
                      )}
                      <button type="button" disabled={isPending} onClick={() => handleRestore(l.id)} className={successBtnCls}>
                        <RotateCcw className="h-3.5 w-3.5" /> Herstel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Scam reports */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
              <FileWarning className="h-4 w-4 text-rose-500" />
              Scam-meldingen
              {reports.length > 0 && <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{reports.length}</span>}
            </h2>
            {reports.length === 0 ? <EmptyState text="Geen openstaande scam-meldingen." /> : (
              <TableWrap>
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <Th>Verhuurder</Th><Th>Advertentie</Th><Th>Melder</Th><Th>Toelichting</Th><Th>Datum</Th><th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-800">{r.landlord_name ?? "—"}</td>
                      <td className="px-4 py-3"><Link href={`/kamers/${r.listing_id}`} className="max-w-[160px] truncate block text-rose-600 hover:underline">{r.listing_title}</Link></td>
                      <td className="px-4 py-3 text-stone-600">{r.reporter_name ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-600"><span title={r.reason} className="line-clamp-2 max-w-[200px]">{r.reason}</span></td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <button type="button" disabled={isPending} onClick={() => handleIgnoreReport(r.id)} className={actionBtnCls}>
                          <Trash2 className="h-3.5 w-3.5" /> Negeer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </section>

          {/* Contact messages */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
              <Mail className="h-4 w-4 text-blue-500" />
              Contactberichten
              {contactMessages.filter((m) => !m.is_read).length > 0 && (
                <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {contactMessages.filter((m) => !m.is_read).length} ongelezen
                </span>
              )}
            </h2>
            {contactMessages.length === 0 ? <EmptyState text="Geen contactberichten ontvangen." /> : (
              <div className="space-y-3">
                {contactMessages.map((msg) => (
                  <div key={msg.id} className={`rounded-2xl border px-5 py-4 shadow-sm transition ${msg.is_read ? "border-stone-100 bg-white" : "border-rose-100 bg-rose-50/50"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">{msg.name}</p>
                        <span className="text-stone-300">·</span>
                        <p className="text-xs text-stone-500">{msg.email}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[msg.category] ?? CATEGORY_STYLES.overig}`}>
                          {CATEGORY_LABELS[msg.category] ?? msg.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-stone-400 whitespace-nowrap">{fmtDate(msg.created_at)}</p>
                        {!msg.is_read && (
                          <button type="button" disabled={isPending} onClick={() => handleMarkRead(msg.id)} className={successBtnCls}>
                            <CheckCheck className="h-3.5 w-3.5" /> Markeer als gelezen
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium text-stone-800">{msg.subject}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* User reports */}
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
              <MessageSquareWarning className="h-4 w-4 text-violet-500" />
              Gebruikersmeldingen
              {userReports.length > 0 && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">{userReports.length}</span>}
            </h2>
            {userReports.length === 0 ? <EmptyState text="Geen openstaande gebruikersmeldingen." /> : (
              <TableWrap>
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <Th>Melder</Th><Th>Gemeld gebruiker</Th><Th>Reden</Th><Th>Datum</Th><th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {userReports.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-800">{r.reporter_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {r.reported_id
                          ? <button type="button" onClick={() => setProfilePanelId(r.reported_id!)} className="font-medium text-rose-600 underline-offset-2 hover:underline">{r.reported_name ?? "—"}</button>
                          : <span className="text-stone-700">{r.reported_name ?? "—"}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${reasonBadgeClass(r.reason)}`}>
                          {reasonLabel(r.reason)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-500">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <button type="button" disabled={isPending} onClick={() => handleDismissUserReport(r.id)} className={successBtnCls}>
                          <CheckCheck className="h-3.5 w-3.5" /> Afgehandeld
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: MODERATIE                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "moderatie" && (
        <AdminModerationTab onPendingCount={setModerationPendingCount} />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: GEBRUIKERS                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "gebruikers" && (
        <div>
          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text" placeholder="Zoek op naam of e-mail…" value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className={`${inputCls} w-full pl-9`}
              />
            </div>
            <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className={selectCls}>
              <option value="alle">Alle rollen</option>
              {USER_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={userVerifFilter} onChange={(e) => setUserVerifFilter(e.target.value)} className={selectCls}>
              <option value="alle">Alle verificaties</option>
              <option value="geverifieerd">Geverifieerd</option>
              <option value="niet">Niet geverifieerd</option>
            </select>
            <span className="ml-auto text-xs text-stone-400">{filteredUsers.length} van {adminUsers.length} gebruikers</span>
          </div>

          {filteredUsers.length === 0 ? <EmptyState text="Geen gebruikers gevonden." /> : (
            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const verified = u.email_auto_verified && u.phone_verified;
                const pendingType = editingUserType[u.id];
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-100 bg-white px-5 py-4 shadow-sm">
                    {/* Avatar + info */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar url={u.avatar_url} name={u.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">{u.name ?? "Naamloos"}</p>
                        <p className="truncate text-xs text-stone-500">{u.email ?? "—"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {u.role === "admin" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Admin</span>}
                          {u.suspended_until && new Date(u.suspended_until).getFullYear() >= 9999 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Verbannen</span>}
                          {u.suspended_until && new Date(u.suspended_until) > new Date() && new Date(u.suspended_until).getFullYear() < 9999 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Geschorst</span>}
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">
                            {u.user_type ? (USER_TYPE_LABELS[u.user_type] ?? u.user_type) : "—"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.subscription_tier === "premium" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                            {u.subscription_tier === "premium" ? "Premium" : "Free"}
                          </span>
                          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${verified ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${verified ? "bg-emerald-500" : "bg-stone-400"}`} />
                            {verified ? "Geverifieerd" : "Niet geverifieerd"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Credits */}
                    <div className="flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-sm">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-semibold text-amber-800">{u.boost_credits}</span>
                      <span className="text-amber-600 text-xs">credits</span>
                    </div>

                    {/* Date */}
                    <span className="text-xs text-stone-400 whitespace-nowrap">{fmtDate(u.created_at)}</span>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Role selector */}
                      <div className="flex items-center gap-1">
                        <select
                          value={pendingType ?? u.user_type ?? ""}
                          onChange={(e) => setEditingUserType((p) => ({ ...p, [u.id]: e.target.value }))}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 focus:border-rose-300 focus:outline-none"
                        >
                          {USER_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        {pendingType && pendingType !== u.user_type && (
                          <button type="button" disabled={isPending} onClick={() => handleSetUserType(u.id, pendingType)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">
                            <UserCog className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <button type="button" disabled={isPending} onClick={() => handleAddCredits(u.id, u.name)} className={successBtnCls}>
                        <Plus className="h-3.5 w-3.5" /> 10 credits
                      </button>
                      {u.role !== "admin" && (
                        u.suspended_until && new Date(u.suspended_until) > new Date()
                          ? <button type="button" disabled={isPending} onClick={() => handleUnsuspendUser(u.id, u.name)} className={successBtnCls}>
                              <ShieldOff className="h-3.5 w-3.5" /> Ophef
                            </button>
                          : <>
                              <button type="button" disabled={isPending} onClick={() => handleSuspendUser(u.id, u.name, 7)} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 active:scale-95">
                                <ShieldOff className="h-3.5 w-3.5" /> Schors
                              </button>
                              <button type="button" disabled={isPending} onClick={() => handleBanUser(u.id, u.name)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 active:scale-95">
                                <ShieldOff className="h-3.5 w-3.5" /> Verban
                              </button>
                            </>
                      )}
                      <button type="button" className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-400 cursor-not-allowed" title="Komt binnenkort">
                        Login als
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ADVERTENTIES                                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "advertenties" && (
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text" placeholder="Zoek op titel, locatie of eigenaar…" value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                className={`${inputCls} w-full pl-9`}
              />
            </div>
            <select value={listingFilter} onChange={(e) => setListingFilter(e.target.value)} className={selectCls}>
              <option value="alle">Alle advertenties</option>
              <option value="uitgelicht">Actief uitgelicht</option>
              <option value="gemeld">Gemelde eigenaar</option>
              <option value="verborgen">Verborgen</option>
            </select>
            <span className="ml-auto text-xs text-stone-400">{filteredListings.length} van {adminListings.length} advertenties</span>
          </div>

          {filteredListings.length === 0 ? <EmptyState text="Geen advertenties gevonden." /> : (
            <TableWrap>
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <Th>Titel</Th><Th>Eigenaar</Th><Th>Prijs</Th><Th>Locatie</Th><Th>Type</Th><Th>Status</Th><Th>Datum</Th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredListings.map((l) => {
                  const active = isBoostActive(l.boosted_at);
                  return (
                    <tr key={l.id} className={`hover:bg-stone-50 ${l.owner_scam_flagged ? "bg-rose-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/kamers/${l.id}`} className="font-medium text-rose-600 hover:underline line-clamp-1 max-w-[180px] block">{l.title}</Link>
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {l.owner_name ?? "—"}
                        {l.owner_scam_flagged && <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">⚠ gemeld</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-stone-800">€{Number(l.price).toFixed(0)}</td>
                      <td className="px-4 py-3 text-stone-600 max-w-[120px] truncate">{l.location}</td>
                      <td className="px-4 py-3 text-stone-600">{LISTING_TYPE_LABELS[l.type] ?? l.type}</td>
                      <td className="px-4 py-3">
                        {l.hidden
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-600">Verborgen</span>
                          : active
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"><Star className="h-2.5 w-2.5" /> Uitgelicht</span>
                            : <span className="text-xs text-stone-400">Normaal</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button type="button" disabled={isPending || active} onClick={() => handleAdminBoost(l.id, l.title)} className={successBtnCls}>
                            <Star className="h-3.5 w-3.5" /> Uitlichten
                          </button>
                          {l.hidden
                            ? <button type="button" disabled={isPending} onClick={() => handleUnhideListing(l.id)} className={successBtnCls}>
                                <EyeOff className="h-3.5 w-3.5" /> Herstel
                              </button>
                            : <button type="button" disabled={isPending} onClick={() => handleHideListing(l.id)} className={actionBtnCls}>
                                <EyeOff className="h-3.5 w-3.5" /> Verberg
                              </button>
                          }
                          <button type="button" disabled={isPending} onClick={() => handleAdminDeleteListing(l.id, l.title)} className={actionBtnCls}>
                            <Trash2 className="h-3.5 w-3.5" /> Verwijder
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: BETALINGEN                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "betalingen" && (
        <div>
          {/* Summary cards */}
          {boostStats && (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <StatCard icon={<Zap className="h-5 w-5 text-amber-500" />} bg="bg-amber-50 border-amber-200" label="Totaal gebruikte credits" value={boostStats.total} />
              <StatCard icon={<CreditCard className="h-5 w-5 text-emerald-500" />} bg="bg-emerald-50 border-emerald-200" label="Boosts vandaag" value={boostStats.today} />
              <StatCard icon={<Activity className="h-5 w-5 text-blue-500" />} bg="bg-blue-50 border-blue-200" label="Boost-transacties totaal" value={boostLogs.length} />
            </div>
          )}

          {boostLogs.length === 0 ? <EmptyState text="Nog geen boost-transacties." /> : (
            <TableWrap>
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <Th>Gebruiker</Th><Th>Advertentie</Th><Th>Actie</Th><Th>Credits</Th><Th>Saldo</Th><Th>Datum &amp; tijd</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {boostLogs.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{r.user_name ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600 max-w-[180px] truncate">{r.listing_title ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        <Zap className="h-3 w-3" /> {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-800">−{r.credits_used}</td>
                    <td className="px-4 py-3">
                      {r.credit_before != null && r.credit_after != null
                        ? <span className="text-xs text-stone-500">{r.credit_before} → <span className="font-semibold text-stone-700">{r.credit_after}</span></span>
                        : <span className="text-xs text-stone-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ACTIVITEIT                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "activiteit" && (
        <div>
          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <select value={activityTypeFilter} onChange={(e) => setActivityTypeFilter(e.target.value)} className={selectCls}>
              <option value="alle">Alle types</option>
              <option value="admin">Admin-acties</option>
              <option value="boost">Boost-acties</option>
            </select>
            <input type="date" value={activityDateFilter} onChange={(e) => setActivityDateFilter(e.target.value)} className={inputCls} />
            {activityDateFilter && (
              <button type="button" onClick={() => setActivityDateFilter("")} className="text-xs text-stone-500 hover:text-rose-600">Wis datum</button>
            )}
            <span className="ml-auto text-xs text-stone-400">{filteredActivity.length} entries</span>
          </div>

          {filteredActivity.length === 0 ? <EmptyState text="Geen activiteit gevonden." /> : (
            <div className="space-y-2">
              {filteredActivity.map((e) => (
                <div key={`${e.source}-${e.id}`} className={`flex items-start gap-4 rounded-2xl border px-5 py-4 shadow-sm ${e.source === "admin" ? "border-rose-100 bg-rose-50/30" : "border-amber-100 bg-amber-50/30"}`}>
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${e.source === "admin" ? "bg-rose-100" : "bg-amber-100"}`}>
                    {e.source === "admin"
                      ? <ShieldCheck className="h-3.5 w-3.5 text-rose-600" />
                      : <Zap className="h-3.5 w-3.5 text-amber-600" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-stone-900">{e.actor_name ?? "Systeem"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${e.source === "admin" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                        {e.source === "admin" ? "Admin" : "Boost"}
                      </span>
                      <span className="text-sm text-stone-700">
                        {e.action === "boost_listing" && e.source === "boost"
                          ? <>uitgelicht: <span className="font-medium">{e.listing_title ?? "—"}</span> (−{e.credits_used} credit{e.credits_used !== 1 ? "s" : ""})</>
                          : e.action === "add_credits"
                            ? <>10 credits toegevoegd aan <span className="font-medium">{(e.details as { user_name?: string })?.user_name ?? e.target_id ?? "—"}</span></>
                            : e.action === "set_user_type"
                              ? <>rol gewijzigd naar <span className="font-medium">{USER_TYPE_LABELS[(e.details as { new_type?: string })?.new_type ?? ""] ?? "—"}</span></>
                              : e.action === "delete_listing"
                                ? <>advertentie verwijderd: <span className="font-medium">{(e.details as { title?: string })?.title ?? e.target_id ?? "—"}</span></>
                                : e.action === "restore_landlord"
                                  ? <>verhuurder hersteld: <span className="font-medium">{e.target_id ?? "—"}</span></>
                                  : e.action === "boost_listing" && e.source === "admin"
                                    ? <>advertentie uitgelicht (admin): <span className="font-medium">{(e.details as { title?: string })?.title ?? e.target_id ?? "—"}</span></>
                                    : <><span className="font-mono text-xs">{e.action}</span> op {e.target_type} {e.target_id ? <span className="font-mono text-xs text-stone-400">{e.target_id.slice(0, 8)}…</span> : null}</>
                        }
                      </span>
                    </div>
                    {e.source === "boost" && e.credit_before != null && e.credit_after != null && (
                      <p className="mt-0.5 text-xs text-stone-400">Saldo: {e.credit_before} → {e.credit_after}</p>
                    )}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-stone-400">{fmtDateTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: SEEDING                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "seeding" && (
        <AdminSeedTab />
      )}

      {/* Security note */}
      <p className="mt-10 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
        Admin-toegang wordt <strong className="font-semibold">nooit automatisch</strong> toegekend.
        Gebruik het Supabase SQL-dashboard:
        <code className="ml-1 font-mono">UPDATE profiles SET role = 'admin' WHERE email = 'EMAIL';</code>
      </p>

      {/* Unused imports kept to avoid lint errors on icon refs */}
      <span className="hidden"><Home /><ChevronDown /></span>
    </div>
  );
}
