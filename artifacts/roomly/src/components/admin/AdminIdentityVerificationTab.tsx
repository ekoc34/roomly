import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, Clock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { IdentityVerification } from "@/types/database";

type VerificationWithProfile = IdentityVerification & {
  user_name: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
};

type StatusFilter = "pending" | "approved" | "rejected" | "alle";

const DOC_TYPE_LABELS: Record<string, string> = {
  passport: "Paspoort",
  id_card: "Identiteitskaart",
  residence_permit: "Verblijfsvergunning",
  drivers_license: "Rijbewijs",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("nl-NL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <ShieldCheck className="h-3 w-3" /> Goedgekeurd
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
        <ShieldX className="h-3 w-3" /> Afgewezen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Clock className="h-3 w-3" /> In behandeling
    </span>
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

export function AdminIdentityVerificationTab() {
  const [verifications, setVerifications] = useState<VerificationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [isPending, startTransition] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [visibleDocs, setVisibleDocs] = useState<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);

  const loadVerifications = useCallback(async (filter: StatusFilter) => {
    if (!supabase) return;
    setLoading(true);

    let q = supabase
      .from("identity_verifications")
      .select("*, profiles!identity_verifications_user_id_fkey(name, email, avatar_url)")
      .order("created_at", { ascending: false });

    if (filter !== "alle") {
      q = q.eq("status", filter);
    }

    const { data } = await q;
    if (data) {
      setVerifications(
        (data as (IdentityVerification & {
          profiles: { name: string | null; email: string | null; avatar_url: string | null } | null;
        })[]).map((r) => ({
          ...r,
          user_name: r.profiles?.name ?? null,
          user_email: r.profiles?.email ?? null,
          user_avatar_url: r.profiles?.avatar_url ?? null,
        }))
      );
    }

    const { count } = await supabase
      .from("identity_verifications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingCount(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadVerifications(statusFilter);
  }, [statusFilter, loadVerifications]);

  const getSignedUrl = async (verificationId: string, path: string) => {
    if (!supabase) return;
    const { data } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(path, 120);
    if (data?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [verificationId]: data.signedUrl }));
    } else {
      toast.error("Kon document niet laden.");
    }
  };

  const toggleDocument = async (v: VerificationWithProfile) => {
    const isVisible = visibleDocs.has(v.id);
    if (isVisible) {
      setVisibleDocs((prev) => { const n = new Set(prev); n.delete(v.id); return n; });
      return;
    }
    setVisibleDocs((prev) => new Set(prev).add(v.id));
    if (!signedUrls[v.id]) {
      await getSignedUrl(v.id, v.document_path);
    }
  };

  const handleApprove = (v: VerificationWithProfile) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase
        .from("identity_verifications")
        .update({
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) { toast.error("Goedkeuren mislukt."); return; }
      await supabase.rpc("log_admin_action", {
        p_action: "approve_identity_verification",
        p_target_type: "user",
        p_target_id: v.user_id,
        p_details: { verification_id: v.id, user_name: v.user_name },
      });
      toast.success(`Identiteit van ${v.user_name ?? "gebruiker"} goedgekeurd.`);
      void loadVerifications(statusFilter);
    });
  };

  const handleRejectConfirm = (v: VerificationWithProfile) => {
    startTransition(async () => {
      if (!supabase) return;
      const { error } = await supabase
        .from("identity_verifications")
        .update({
          status: "rejected",
          rejection_reason: rejectReason.trim() || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) { toast.error("Afwijzen mislukt."); return; }
      await supabase.rpc("log_admin_action", {
        p_action: "reject_identity_verification",
        p_target_type: "user",
        p_target_id: v.user_id,
        p_details: { verification_id: v.id, reason: rejectReason.trim() || null, user_name: v.user_name },
      });
      toast.success(`Verificatie van ${v.user_name ?? "gebruiker"} afgewezen.`);
      setRejectingId(null);
      setRejectReason("");
      void loadVerifications(statusFilter);
    });
  };

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "pending", label: `In behandeling${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { key: "approved", label: "Goedgekeurd" },
    { key: "rejected", label: "Afgewezen" },
    { key: "alle", label: "Alle" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Identiteitsverificaties</h2>
        <p className="mt-1 text-sm text-stone-500">
          Beoordeel ingediende identiteitsdocumenten van verhuurders. Goedkeuring geeft het "Identiteit geverifieerd" keurmerk.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`rounded-xl px-4 py-1.5 text-sm font-medium transition ${
              statusFilter === key
                ? "bg-rose-500 text-white shadow-sm"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-stone-400">Laden…</div>
      ) : verifications.length === 0 ? (
        <div className="rounded-2xl border border-stone-100 bg-white px-6 py-10 text-center text-sm text-stone-400 shadow-sm">
          Geen verificaties gevonden.
        </div>
      ) : (
        <div className="space-y-4">
          {verifications.map((v) => {
            const isDocVisible = visibleDocs.has(v.id);
            const isRejecting = rejectingId === v.id;

            return (
              <div
                key={v.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar url={v.user_avatar_url} name={v.user_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-stone-900">{v.user_name ?? "Onbekend"}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">{v.user_email ?? "—"}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Documenttype: <span className="font-medium">{DOC_TYPE_LABELS[v.document_type] ?? v.document_type}</span>
                    </p>
                    <p className="text-xs text-stone-400">Ingediend: {fmtDateTime(v.submitted_at)}</p>
                    {v.reviewed_at && (
                      <p className="text-xs text-stone-400">Beoordeeld: {fmtDateTime(v.reviewed_at)}</p>
                    )}
                    {v.rejection_reason && (
                      <p className="mt-1 text-xs text-rose-600">
                        Reden: {v.rejection_reason}
                      </p>
                    )}
                  </div>

                  {/* Document toggle */}
                  <button
                    type="button"
                    onClick={() => void toggleDocument(v)}
                    className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                  >
                    {isDocVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {isDocVisible ? "Verberg" : "Bekijk document"}
                  </button>
                </div>

                {/* Document preview */}
                {isDocVisible && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                    {signedUrls[v.id] ? (
                      <div className="p-2">
                        <img
                          src={signedUrls[v.id]}
                          alt="Identiteitsdocument"
                          className="max-h-96 w-full rounded-lg object-contain"
                          onError={() => {
                            const url = signedUrls[v.id];
                            setSignedUrls((prev) => ({ ...prev, [v.id]: "" }));
                            if (url) {
                              window.open(url, "_blank", "noopener,noreferrer");
                            }
                          }}
                        />
                        <p className="mt-2 text-center text-[10px] text-stone-400">
                          Ondertekende URL verloopt over ±2 minuten · document wordt nooit publiek opgeslagen
                        </p>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-stone-400">Document laden…</div>
                    )}
                  </div>
                )}

                {/* Actions — only for pending */}
                {v.status === "pending" && (
                  <div className="mt-4 space-y-3">
                    {isRejecting ? (
                      <div className="space-y-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reden voor afwijzing (optioneel, zichtbaar voor gebruiker)"
                          rows={2}
                          className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRejectConfirm(v)}
                            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
                          >
                            Bevestig afwijzing
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleApprove(v)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Goedkeuren
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setRejectingId(v.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Afwijzen
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
