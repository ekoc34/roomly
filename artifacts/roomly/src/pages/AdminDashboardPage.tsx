/**
 * Admin Dashboard — Welkthuis.nl
 *
 * Access is restricted to users with role = 'admin'.
 * Admin privileges are NEVER assigned automatically. The only way to promote
 * a user to admin is by running the following SQL in the Supabase SQL Editor:
 *
 *   UPDATE profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL';
 *
 * No other code path in this application sets role = 'admin'.
 */

import { useEffect, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, Trash2, RotateCcw, Users, FileWarning, Home } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type FlaggedLandlord = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  scam_count: number;
  latest_report: string | null;
};

type ScamReport = {
  id: string;
  reason: string;
  created_at: string;
  listing_id: string;
  listing_title: string;
  landlord_name: string | null;
  reporter_name: string | null;
};

type Stats = {
  flaggedCount: number;
  scamReportCount: number;
  totalListings: number;
};

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [landlords, setLandlords] = useState<FlaggedLandlord[]>([]);
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── 1. Fetch role ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !supabase) { setRoleLoading(false); return; }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole(data?.role ?? null);
        setRoleLoading(false);
      });
  }, [user]);

  // ── 2. Redirect non-admins ─────────────────────────────────────────────────
  useEffect(() => {
    if (roleLoading) return;
    if (!user || role !== "admin") {
      toast.error("Je hebt geen toegang tot deze pagina.");
      navigate("/dashboard");
    }
  }, [role, roleLoading, user, navigate]);

  // ── 3. Fetch dashboard data ────────────────────────────────────────────────
  async function loadData() {
    if (!supabase) return;

    // Flagged landlords + their scam report counts
    const { data: flaggedProfiles } = await supabase
      .from("profiles")
      .select("id, name, email, avatar_url")
      .eq("scam_flagged", true);

    if (flaggedProfiles && flaggedProfiles.length > 0) {
      const enriched: FlaggedLandlord[] = await Promise.all(
        (flaggedProfiles as { id: string; name: string | null; email: string | null; avatar_url: string | null }[]).map(async (p) => {
          const { data: repData } = await supabase!
            .from("listing_reports")
            .select("created_at, listings!inner(user_id)")
            .eq("category", "scam")
            .eq("listings.user_id", p.id)
            .order("created_at", { ascending: false });

          const rows = (repData ?? []) as { created_at: string }[];
          return {
            ...p,
            scam_count: rows.length,
            latest_report: rows[0]?.created_at ?? null,
          };
        })
      );
      setLandlords(enriched);
    } else {
      setLandlords([]);
    }

    // Scam reports list — joined with listing title and reporter name
    const { data: repRows } = await supabase
      .from("listing_reports")
      .select(`
        id, reason, created_at, listing_id,
        listings ( title, profiles ( name ) ),
        profiles ( name )
      `)
      .eq("category", "scam")
      .order("created_at", { ascending: false });

    if (repRows) {
      const mapped = (repRows as {
        id: string;
        reason: string;
        created_at: string;
        listing_id: string;
        listings: { title: string; profiles: { name: string | null } | null } | null;
        profiles: { name: string | null } | null;
      }[]).map((r) => ({
        id: r.id,
        reason: r.reason,
        created_at: r.created_at,
        listing_id: r.listing_id,
        listing_title: r.listings?.title ?? "—",
        landlord_name: r.listings?.profiles?.name ?? null,
        reporter_name: r.profiles?.name ?? null,
      }));
      setReports(mapped);
    }

    // Quick stats
    const [{ count: flaggedCount }, { count: scamCount }, { count: listingsCount }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("scam_flagged", true),
      supabase.from("listing_reports").select("*", { count: "exact", head: true }).eq("category", "scam"),
      supabase.from("listings").select("*", { count: "exact", head: true }),
    ]);
    setStats({
      flaggedCount: flaggedCount ?? 0,
      scamReportCount: scamCount ?? 0,
      totalListings: listingsCount ?? 0,
    });
  }

  useEffect(() => {
    if (role === "admin") loadData();
  }, [role]);

  // ── 4. Actions ─────────────────────────────────────────────────────────────
  const handleRestore = (landlordId: string) => {
    startTransition(async () => {
      if (!supabase) return;

      // Step 1: get current email/phone verification state
      const { data: prof } = await supabase
        .from("profiles")
        .select("email_auto_verified, phone_verified")
        .eq("id", landlordId)
        .maybeSingle();

      // Step 2: clear scam flag; badge is restored by sync_verification_badge trigger
      // if email_auto_verified AND phone_verified remain true
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ scam_flagged: false })
        .eq("id", landlordId);

      if (updateErr) { toast.error("Herstellen mislukt."); return; }

      // Step 3: if both verifications were still set (they were revoked by the trigger —
      // so they'll be false). Re-enable both so the badge sync trigger can fire.
      if (prof && !prof.email_auto_verified && !prof.phone_verified) {
        await supabase
          .from("profiles")
          .update({ email_auto_verified: true, phone_verified: true })
          .eq("id", landlordId);
      }

      // Step 4: delete all scam reports for this landlord's listings
      const { data: theirListings } = await supabase
        .from("listings")
        .select("id")
        .eq("user_id", landlordId);

      if (theirListings && theirListings.length > 0) {
        const ids = (theirListings as { id: string }[]).map((l) => l.id);
        await supabase
          .from("listing_reports")
          .delete()
          .in("listing_id", ids)
          .eq("category", "scam");
      }

      toast.success("Verhuurder hersteld.");
      loadData();
    });
  };

  const handleIgnoreReport = (reportId: string) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase.from("listing_reports").delete().eq("id", reportId);
      if (error) { toast.error("Verwijderen mislukt."); return; }
      toast.success("Rapport verwijderd.");
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setStats((s) => s ? { ...s, scamReportCount: Math.max(0, s.scamReportCount - 1) } : s);
    });
  };

  // ── 5. Render guards ───────────────────────────────────────────────────────
  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
      </div>
    );
  }

  if (!user || role !== "admin") return null;

  // ── 6. Page ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">Admin Dashboard</span>
      </nav>

      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100">
          <ShieldCheck className="h-5 w-5 text-rose-600" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
          <p className="text-sm text-stone-500">Beheer gemelde verhuurders en fraudemeldingen.</p>
        </div>
      </div>

      {/* ── Section C: Quick Stats ── */}
      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            bg="bg-amber-50 border-amber-200"
            label="Gemarkeerde verhuurders"
            value={stats.flaggedCount}
          />
          <StatCard
            icon={<FileWarning className="h-5 w-5 text-rose-500" />}
            bg="bg-rose-50 border-rose-200"
            label="Openstaande scam-meldingen"
            value={stats.scamReportCount}
          />
          <StatCard
            icon={<Home className="h-5 w-5 text-emerald-500" />}
            bg="bg-emerald-50 border-emerald-200"
            label="Totaal advertenties"
            value={stats.totalListings}
          />
        </div>
      )}

      {/* ── Section A: Reported Landlords ── */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Gemarkeerde verhuurders
          {landlords.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{landlords.length}</span>
          )}
        </h2>
        {landlords.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white px-6 py-10 text-center text-sm text-stone-400 shadow-sm">
            Geen gemarkeerde verhuurders gevonden.
          </div>
        ) : (
          <div className="space-y-3">
            {landlords.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200">
                    {l.avatar_url ? (
                      <img src={l.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-stone-500">{(l.name ?? l.email ?? "?").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
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
                      <p className="text-sm font-semibold text-stone-700">{new Date(l.latest_report).toLocaleDateString("nl-NL")}</p>
                      <p className="text-xs text-stone-500">laatste melding</p>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRestore(l.id)}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Herstel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section B: Scam Reports List ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900">
          <FileWarning className="h-4 w-4 text-rose-500" />
          Scam-meldingen
          {reports.length > 0 && (
            <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{reports.length}</span>
          )}
        </h2>
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-stone-100 bg-white px-6 py-10 text-center text-sm text-stone-400 shadow-sm">
            Geen openstaande scam-meldingen.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Verhuurder</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Advertentie</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Melder</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Toelichting</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Datum</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-800">{r.landlord_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/kamers/${r.listing_id}`}
                          className="max-w-[160px] truncate block text-rose-600 hover:underline"
                        >
                          {r.listing_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{r.reporter_name ?? "—"}</td>
                      <td className="px-4 py-3 text-stone-600">
                        <span title={r.reason} className="line-clamp-2 max-w-[200px]">{r.reason}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("nl-NL")}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleIgnoreReport(r.id)}
                          title="Negeer rapport"
                          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Negeer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Security note */}
      <p className="mt-8 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
        Admin-toegang wordt <strong className="font-semibold">nooit automatisch</strong> toegekend. Gebruik het Supabase SQL-dashboard om handmatig een gebruiker te promoveren:
        <code className="ml-1 font-mono">UPDATE profiles SET role = 'admin' WHERE email = 'EMAIL';</code>
      </p>
    </div>
  );
}

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
