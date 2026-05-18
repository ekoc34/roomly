import { useCallback, useEffect, useState, useTransition } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  CheckCheck, XCircle, Eye, EyeOff, ShieldOff, Shield,
  MessageSquare, AlertTriangle, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Local types ────────────────────────────────────────────────────────────

type ListingReport = {
  id: string; listing_id: string; category: string; reason: string;
  status: string; created_at: string;
  listing_title: string | null; listing_hidden: boolean;
  owner_id: string | null; owner_name: string | null; reporter_name: string | null;
};

type UserReportMod = {
  id: string; reason: string; status: string; created_at: string;
  reported_id: string | null; reported_name: string | null;
  suspended_until: string | null; reporter_name: string | null;
};

type ConvReport = {
  id: string; conversation_id: string; category: string; reason: string;
  status: string; created_at: string; reporter_name: string | null;
};

type AutoFlag = {
  id: string; target_type: string; target_id: string | null;
  trigger_type: string; severity: "low" | "medium" | "high";
  reason: string; details: Record<string, unknown> | null;
  dismissed: boolean; created_at: string;
};

type InspectMessage = {
  id: string; sender_id: string; sender_name: string;
  body: string; created_at: string;
};

type ResolveDialog = {
  reportType: "listing" | "user" | "conversation";
  reportId: string;
  action: "resolved" | "dismissed";
  note: string;
};

type SuspendDialog = {
  userId: string; userName: string | null;
  days: string; reason: string; isBan: boolean;
};

type Props = {
  onPendingCount?: (n: number) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  scam: "Oplichting", fake_listing: "Nep advertentie", spam: "Spam",
  harassment: "Intimidatie", inappropriate: "Ongepast",
  duplicate: "Duplicaat", other: "Anders",
};

const CATEGORY_COLORS: Record<string, string> = {
  scam: "bg-red-100 text-red-700", fake_listing: "bg-orange-100 text-orange-700",
  spam: "bg-amber-100 text-amber-700", harassment: "bg-purple-100 text-purple-700",
  inappropriate: "bg-pink-100 text-pink-700",
  duplicate: "bg-stone-100 text-stone-600", other: "bg-stone-100 text-stone-600",
};

function CatBadge({ cat }: { cat: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[cat] ?? "bg-stone-100 text-stone-600"}`}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isBanned(until: string | null) {
  if (!until) return false;
  return new Date(until).getFullYear() >= 9999;
}

function isSuspended(until: string | null) {
  if (!until) return false;
  return !isBanned(until) && new Date(until) > new Date();
}

const actionBtn = "flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 active:scale-95";
const successBtn = "flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 active:scale-95";
const warnBtn = "flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-40 active:scale-95";
const dangerBtn = "flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-40 active:scale-95";

// ── Main component ─────────────────────────────────────────────────────────

export function AdminModerationTab({ onPendingCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [migrationError, setMigrationError] = useState(false);

  const [listingReports, setListingReports] = useState<ListingReport[]>([]);
  const [userReportsMod, setUserReportsMod] = useState<UserReportMod[]>([]);
  const [convReports, setConvReports] = useState<ConvReport[]>([]);
  const [autoFlags, setAutoFlags] = useState<AutoFlag[]>([]);

  const [resolveDialog, setResolveDialog] = useState<ResolveDialog | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<SuspendDialog | null>(null);
  const [inspectorConvId, setInspectorConvId] = useState<string | null>(null);
  const [inspectorMessages, setInspectorMessages] = useState<InspectMessage[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setMigrationError(false);
    try {
      const [lrRes, urRes, crRes, afRes] = await Promise.all([
        supabase
          .from("listing_reports")
          .select(`id, listing_id, category, reason, status, created_at,
            listings ( title, hidden, user_id, profiles ( name ) ),
            reporter:reporter_id ( name )`)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("user_reports")
          .select(`id, reason, status, created_at, reported_id,
            reporter:reporter_id ( name ),
            reported:reported_id ( name, suspended_until )`)
          .eq("status", "pending")
          .neq("reason", "blocked")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("conversation_reports")
          .select(`id, conversation_id, category, reason, status, created_at,
            reporter:reporter_id ( name )`)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(100),

        supabase
          .from("auto_flags")
          .select("id, target_type, target_id, trigger_type, severity, reason, details, dismissed, created_at")
          .eq("dismissed", false)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (lrRes.error) throw lrRes.error;

      type RawLR = {
        id: string; listing_id: string; category: string; reason: string;
        status: string; created_at: string;
        listings: { title: string; hidden: boolean; user_id: string; profiles: { name: string | null } | null } | null;
        reporter: { name: string | null } | null;
      };
      const lr = ((lrRes.data ?? []) as unknown as RawLR[]).map((r) => ({
        id: r.id, listing_id: r.listing_id, category: r.category,
        reason: r.reason, status: r.status, created_at: r.created_at,
        listing_title: r.listings?.title ?? null,
        listing_hidden: r.listings?.hidden ?? false,
        owner_id: r.listings?.user_id ?? null,
        owner_name: r.listings?.profiles?.name ?? null,
        reporter_name: r.reporter?.name ?? null,
      }));
      setListingReports(lr);

      if (!urRes.error && urRes.data) {
        type RawUR = {
          id: string; reason: string; status: string; created_at: string;
          reported_id: string | null;
          reporter: { name: string | null } | null;
          reported: { name: string | null; suspended_until: string | null } | null;
        };
        setUserReportsMod(((urRes.data) as unknown as RawUR[]).map((r) => ({
          id: r.id, reason: r.reason, status: r.status, created_at: r.created_at,
          reported_id: r.reported_id ?? null,
          reported_name: r.reported?.name ?? null,
          suspended_until: r.reported?.suspended_until ?? null,
          reporter_name: r.reporter?.name ?? null,
        })));
      }

      if (!crRes.error && crRes.data) {
        type RawCR = {
          id: string; conversation_id: string; category: string; reason: string;
          status: string; created_at: string; reporter: { name: string | null } | null;
        };
        setConvReports(((crRes.data) as unknown as RawCR[]).map((r) => ({
          id: r.id, conversation_id: r.conversation_id, category: r.category,
          reason: r.reason, status: r.status, created_at: r.created_at,
          reporter_name: r.reporter?.name ?? null,
        })));
      }

      if (!afRes.error && afRes.data) {
        setAutoFlags(afRes.data as unknown as AutoFlag[]);
      }

      const total = lr.length + (urRes.data?.length ?? 0) + (crRes.data?.length ?? 0) + (afRes.data?.length ?? 0);
      onPendingCount?.(total);
    } catch {
      setMigrationError(true);
      onPendingCount?.(0);
    } finally {
      setLoading(false);
    }
  }, [onPendingCount]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleResolve = () => {
    if (!resolveDialog || !supabase) return;
    startTransition(async () => {
      const { reportType, reportId, action, note } = resolveDialog;
      const rpc =
        reportType === "listing"      ? "admin_resolve_listing_report" :
        reportType === "user"         ? "admin_resolve_user_report" :
                                        "admin_resolve_conversation_report";
      const { error } = await supabase!.rpc(rpc, {
        p_report_id: reportId,
        p_status:    action,
        p_note:      note.trim() || null,
      });
      if (error) { toast.error("Actie mislukt."); return; }
      toast.success(action === "resolved" ? "Melding opgelost." : "Melding verworpen.");
      setResolveDialog(null);
      loadData();
    });
  };

  const handleHide = (listingId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_hide_listing", {
        p_listing_id: listingId,
        p_reason: "Verborgen door moderator",
      });
      if (error) { toast.error("Verbergen mislukt."); return; }
      toast.success("Advertentie verborgen voor publiek.");
      setListingReports((prev) =>
        prev.map((r) => r.listing_id === listingId ? { ...r, listing_hidden: true } : r)
      );
    });
  };

  const handleDismissFlag = (flagId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.from("auto_flags").update({ dismissed: true }).eq("id", flagId);
      if (error) { toast.error("Verwerpen mislukt."); return; }
      toast.success("Melding verworpen.");
      setAutoFlags((prev) => prev.filter((f) => f.id !== flagId));
      onPendingCount?.(listingReports.length + userReportsMod.length + convReports.length + autoFlags.length - 1);
    });
  };

  const handleUnhide = (listingId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("admin_unhide_listing", { p_listing_id: listingId });
      if (error) { toast.error("Herstellen mislukt."); return; }
      toast.success("Advertentie weer zichtbaar.");
      setListingReports((prev) =>
        prev.map((r) => r.listing_id === listingId ? { ...r, listing_hidden: false } : r)
      );
    });
  };

  const handleSuspend = () => {
    if (!suspendDialog || !supabase) return;
    startTransition(async () => {
      const { userId, userName, days, reason, isBan } = suspendDialog;
      const { error } = await supabase!.rpc(isBan ? "admin_ban_user" : "admin_suspend_user", {
        p_user_id: userId,
        ...(isBan ? {} : { p_days: Number(days) }),
        p_reason: reason.trim() || null,
      });
      if (error) {
        if (error.message?.includes("CANNOT")) toast.error("Je kunt geen admin schorsen of verbannen.");
        else toast.error("Actie mislukt.");
        return;
      }
      toast.success(isBan ? `${userName ?? "Gebruiker"} permanent verbannen.` : `${userName ?? "Gebruiker"} geschorst voor ${days} dagen.`);
      setSuspendDialog(null);
      loadData();
    });
  };

  const handleInspect = async (convId: string) => {
    if (!supabase) return;
    setInspectorConvId(convId);
    setInspectorMessages([]);
    setInspectorLoading(true);
    const { data, error } = await supabase.rpc("admin_inspect_conversation", {
      p_conversation_id: convId,
    });
    setInspectorLoading(false);
    if (error) { toast.error("Berichten laden mislukt."); setInspectorConvId(null); return; }
    setInspectorMessages((data ?? []) as InspectMessage[]);
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-3 text-sm text-stone-400">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
        Meldingen laden…
      </div>
    );
  }

  if (migrationError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-semibold text-amber-800">Migratie vereist</p>
        <p className="mt-1 text-sm text-amber-700">
          Voer eerst <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">supabase/migrations/moderation.sql</code> uit in het Supabase SQL-dashboard.
        </p>
        <button type="button" onClick={loadData} className={`mt-4 ${successBtn}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Opnieuw proberen
        </button>
      </div>
    );
  }

  const total = listingReports.length + userReportsMod.length + convReports.length + autoFlags.length;

  // ── Full render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Advertentie-meldingen", count: listingReports.length, color: "bg-rose-50 border-rose-200 text-rose-700" },
          { label: "Gebruikersmeldingen",   count: userReportsMod.length, color: "bg-violet-50 border-violet-200 text-violet-700" },
          { label: "Gespreksmeldingen",     count: convReports.length,    color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Auto-vlaggen",          count: autoFlags.length,      color: "bg-amber-50 border-amber-200 text-amber-700" },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-4 rounded-2xl border p-5 ${s.color}`}>
            <AlertTriangle className="h-5 w-5 shrink-0 opacity-70" />
            <div>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs opacity-80">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-stone-100 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <CheckCheck className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="mt-3 font-semibold text-stone-700">Alles afgehandeld</p>
          <p className="mt-1 text-sm text-stone-400">Er zijn geen openstaande meldingen.</p>
        </div>
      )}

      {/* ── Advertentie-meldingen ───────────────────────────────────────── */}
      {listingReports.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">{listingReports.length}</span>
            Advertentie-meldingen
          </h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">Advertentie</th>
                    <th className="px-4 py-3">Eigenaar</th>
                    <th className="px-4 py-3">Melder</th>
                    <th className="px-4 py-3">Reden</th>
                    <th className="px-4 py-3">Toelichting</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {listingReports.map((r) => (
                    <tr key={r.id} className={`hover:bg-stone-50 ${r.listing_hidden ? "bg-stone-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.listing_hidden && (
                            <span className="rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">Verborgen</span>
                          )}
                          <Link href={`/kamers/${r.listing_id}`} target="_blank"
                            className="line-clamp-1 max-w-[160px] text-rose-600 hover:underline">
                            {r.listing_title ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-stone-700">{r.owner_name ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{r.reporter_name ?? "—"}</td>
                      <td className="px-4 py-3"><CatBadge cat={r.category} /></td>
                      <td className="px-4 py-3">
                        <span title={r.reason} className="line-clamp-2 max-w-[200px] text-xs text-stone-500">{r.reason}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-400">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.listing_hidden
                            ? <button type="button" disabled={isPending} onClick={() => handleUnhide(r.listing_id)} className={successBtn}>
                                <Eye className="h-3.5 w-3.5" /> Herstel
                              </button>
                            : <button type="button" disabled={isPending} onClick={() => handleHide(r.listing_id)} className={warnBtn}>
                                <EyeOff className="h-3.5 w-3.5" /> Verberg
                              </button>
                          }
                          <button type="button" disabled={isPending}
                            onClick={() => setResolveDialog({ reportType: "listing", reportId: r.id, action: "resolved", note: "" })}
                            className={successBtn}>
                            <CheckCheck className="h-3.5 w-3.5" /> Opgelost
                          </button>
                          <button type="button" disabled={isPending}
                            onClick={() => setResolveDialog({ reportType: "listing", reportId: r.id, action: "dismissed", note: "" })}
                            className={actionBtn}>
                            <XCircle className="h-3.5 w-3.5" /> Verwerp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Gebruikersmeldingen ─────────────────────────────────────────── */}
      {userReportsMod.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{userReportsMod.length}</span>
            Gebruikersmeldingen
          </h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">Melder</th>
                    <th className="px-4 py-3">Gemelde gebruiker</th>
                    <th className="px-4 py-3">Reden</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {userReportsMod.map((r) => {
                    const banned = isBanned(r.suspended_until);
                    const suspended = isSuspended(r.suspended_until);
                    return (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-medium text-stone-800">{r.reporter_name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-stone-800">{r.reported_name ?? "—"}</span>
                            {banned && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">Verbannen</span>}
                            {suspended && !banned && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Geschorst</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="line-clamp-2 max-w-[200px] text-xs text-stone-500" title={r.reason}>{r.reason}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-400">{fmtDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {r.reported_id && !banned && !suspended && (
                              <button type="button" disabled={isPending}
                                onClick={() => setSuspendDialog({ userId: r.reported_id!, userName: r.reported_name, days: "7", reason: "", isBan: false })}
                                className={warnBtn}>
                                <ShieldOff className="h-3.5 w-3.5" /> Schors
                              </button>
                            )}
                            {r.reported_id && !banned && (
                              <button type="button" disabled={isPending}
                                onClick={() => setSuspendDialog({ userId: r.reported_id!, userName: r.reported_name, days: "0", reason: "", isBan: true })}
                                className={dangerBtn}>
                                <XCircle className="h-3.5 w-3.5" /> Verban
                              </button>
                            )}
                            <button type="button" disabled={isPending}
                              onClick={() => setResolveDialog({ reportType: "user", reportId: r.id, action: "resolved", note: "" })}
                              className={successBtn}>
                              <CheckCheck className="h-3.5 w-3.5" /> Opgelost
                            </button>
                            <button type="button" disabled={isPending}
                              onClick={() => setResolveDialog({ reportType: "user", reportId: r.id, action: "dismissed", note: "" })}
                              className={actionBtn}>
                              <XCircle className="h-3.5 w-3.5" /> Verwerp
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Gespreksmeldingen ───────────────────────────────────────────── */}
      {convReports.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{convReports.length}</span>
            Gespreksmeldingen
          </h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <th className="px-4 py-3">Melder</th>
                    <th className="px-4 py-3">Reden</th>
                    <th className="px-4 py-3">Toelichting</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {convReports.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-800">{r.reporter_name ?? "—"}</td>
                      <td className="px-4 py-3"><CatBadge cat={r.category} /></td>
                      <td className="px-4 py-3">
                        <span className="line-clamp-2 max-w-[200px] text-xs text-stone-500" title={r.reason}>{r.reason}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-400">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" disabled={isPending}
                            onClick={() => handleInspect(r.conversation_id)}
                            className={`${actionBtn} border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700`}>
                            <MessageSquare className="h-3.5 w-3.5" /> Berichten
                          </button>
                          <button type="button" disabled={isPending}
                            onClick={() => setResolveDialog({ reportType: "conversation", reportId: r.id, action: "resolved", note: "" })}
                            className={successBtn}>
                            <CheckCheck className="h-3.5 w-3.5" /> Opgelost
                          </button>
                          <button type="button" disabled={isPending}
                            onClick={() => setResolveDialog({ reportType: "conversation", reportId: r.id, action: "dismissed", note: "" })}
                            className={actionBtn}>
                            <XCircle className="h-3.5 w-3.5" /> Verwerp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Auto-flags (shadow moderation) ──────────────────────────────── */}
      {autoFlags.length > 0 && (
        <section>
          <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3.5">
              <Shield className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-800">Auto-vlaggen</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-700">{autoFlags.length}</span>
              <span className="ml-auto text-xs text-amber-600">Automatisch gedetecteerd door het spamsysteem</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs text-stone-400">
                    <th className="px-4 py-2.5">Doelwit</th>
                    <th className="px-4 py-2.5">Trigger</th>
                    <th className="px-4 py-2.5">Ernst</th>
                    <th className="px-4 py-2.5">Reden</th>
                    <th className="px-4 py-2.5">Datum</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {autoFlags.map((f) => {
                    const sevClass = f.severity === "high" ? "bg-red-100 text-red-700" : f.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600";
                    const sevLabel = f.severity === "high" ? "Hoog" : f.severity === "medium" ? "Gemiddeld" : "Laag";
                    const targetLabel: Record<string, string> = { listing: "Advertentie", user: "Gebruiker", conversation: "Gesprek" };
                    return (
                      <tr key={f.id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-stone-700">{targetLabel[f.target_type] ?? f.target_type}</span>
                            {f.target_id && f.target_type === "listing" && (
                              <Link href={`/kamers/${f.target_id}`} className="text-[10px] text-rose-500 hover:underline" target="_blank">
                                {f.target_id.slice(0, 8)}…
                              </Link>
                            )}
                            {f.target_id && f.target_type !== "listing" && (
                              <span className="font-mono text-[10px] text-stone-400">{f.target_id.slice(0, 8)}…</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">{f.trigger_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sevClass}`}>{sevLabel}</span>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-stone-500">{f.reason || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-400">{fmtDate(f.created_at)}</td>
                        <td className="px-4 py-3">
                          <button type="button" disabled={isPending} onClick={() => handleDismissFlag(f.id)} className={actionBtn}>
                            <XCircle className="h-3.5 w-3.5" /> Verwerp
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── Resolve dialog ──────────────────────────────────────────────── */}
      {resolveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setResolveDialog(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-stone-900">
              {resolveDialog.action === "resolved" ? "Melding oplossen" : "Melding verwerpen"}
            </h3>
            <p className="mt-1 text-sm text-stone-500">Voeg een optionele notitie toe voor het auditlogboek.</p>
            <textarea
              rows={3}
              maxLength={500}
              value={resolveDialog.note}
              onChange={(e) => setResolveDialog((d) => d ? { ...d, note: e.target.value } : d)}
              placeholder="Moderatienotitie (optioneel)…"
              className="mt-4 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={isPending} onClick={handleResolve}
                className={`flex-1 rounded-2xl ${resolveDialog.action === "resolved" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-stone-700 hover:bg-stone-800"} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 active:scale-[0.98]`}>
                {isPending ? "Bezig…" : (resolveDialog.action === "resolved" ? "Oplossen" : "Verwerpen")}
              </button>
              <button type="button" onClick={() => setResolveDialog(null)}
                className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Suspend / ban dialog ────────────────────────────────────────── */}
      {suspendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setSuspendDialog(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-stone-900">
              {suspendDialog.isBan ? `${suspendDialog.userName ?? "Gebruiker"} permanent verbannen` : `${suspendDialog.userName ?? "Gebruiker"} schorsen`}
            </h3>
            {!suspendDialog.isBan && (
              <div className="mt-4">
                <label className="text-xs font-medium text-stone-700">Aantal dagen</label>
                <div className="mt-1.5 flex gap-2">
                  {["1","3","7","14","30"].map((d) => (
                    <button key={d} type="button"
                      onClick={() => setSuspendDialog((s) => s ? { ...s, days: d } : s)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        suspendDialog.days === d
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-stone-200 text-stone-600 hover:border-stone-300"
                      }`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4">
              <label className="text-xs font-medium text-stone-700">Reden (intern)</label>
              <textarea
                rows={2}
                maxLength={500}
                value={suspendDialog.reason}
                onChange={(e) => setSuspendDialog((s) => s ? { ...s, reason: e.target.value } : s)}
                placeholder="Reden voor schorsing/verbanning…"
                className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={isPending} onClick={handleSuspend}
                className={`flex-1 rounded-2xl ${suspendDialog.isBan ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 active:scale-[0.98]`}>
                {isPending ? "Bezig…" : suspendDialog.isBan ? "Permanent verbannen" : `${suspendDialog.days} dagen schorsen`}
              </button>
              <button type="button" onClick={() => setSuspendDialog(null)}
                className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Conversation inspector ──────────────────────────────────────── */}
      {inspectorConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setInspectorConvId(null)}>
          <div className="flex w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl" style={{ maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <h3 className="text-base font-semibold text-stone-900">Berichtenhistorie inzien</h3>
              </div>
              <button type="button" onClick={() => setInspectorConvId(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {inspectorLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-blue-500" />
                </div>
              ) : inspectorMessages.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-400">Geen berichten gevonden.</p>
              ) : (
                <div className="space-y-3">
                  {inspectorMessages.map((m) => (
                    <div key={m.id} className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700">{m.sender_name}</span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(m.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-stone-600">{m.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-stone-100 px-6 py-3">
              <p className="flex items-center gap-1.5 text-xs text-stone-400">
                <Shield className="h-3 w-3" />
                Deze inzage is gelogd in het auditlogboek.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
