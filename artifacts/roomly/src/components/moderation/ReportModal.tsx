import { useState, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

type Category = "scam" | "fake_listing" | "spam" | "harassment" | "inappropriate" | "duplicate" | "other";

export type ReportTargetType = "listing" | "user" | "conversation";

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  onClose: () => void;
};

export function ReportModal({ targetType, targetId, targetLabel, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [category, setCategory] = useState<Category>("spam");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const CATEGORIES: { value: Category; labelKey: string }[] = [
    { value: "scam",          labelKey: "report.catScam" },
    { value: "fake_listing",  labelKey: "report.catFakeListing" },
    { value: "spam",          labelKey: "report.catSpam" },
    { value: "harassment",    labelKey: "report.catHarassment" },
    { value: "inappropriate", labelKey: "report.catInappropriate" },
    { value: "duplicate",     labelKey: "report.catDuplicate" },
    { value: "other",         labelKey: "report.catOther" },
  ];

  const ENTITY_LABEL_KEYS: Record<ReportTargetType, string> = {
    listing:      "report.entityListing",
    user:         "report.entityUser",
    conversation: "report.entityConversation",
  };

  const entity = t(ENTITY_LABEL_KEYS[targetType]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) { setError(t("report.errorRequired")); return; }
    startTransition(async () => {
      if (!supabase || !user) { setError(t("report.errorNotLoggedIn")); return; }
      const { error: err } = await supabase.rpc("submit_report", {
        p_target_type: targetType,
        p_target_id:   targetId,
        p_category:    category,
        p_reason:      reason.trim(),
      });
      if (err) {
        if (err.message?.includes("RATE_LIMITED"))
          setError(t("report.errorRateLimit"));
        else if (err.message?.includes("DUPLICATE_REPORT"))
          setError(t("report.errorDuplicate", { entity }));
        else if (err.message?.includes("NOT_AUTHENTICATED"))
          setError(t("report.errorNotAuth"));
        else
          setError(t("report.errorGeneral"));
        return;
      }
      setDone(true);
      toast.success(t("report.toast"));
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-stone-900">{t("report.successTitle")}</h3>
            <p className="mt-2 text-sm text-stone-500">
              {t("report.successDesc")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                  <Flag className="h-4 w-4 text-rose-600" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">
                    {targetLabel
                      ? t("report.modalTitleWithLabel", { label: targetLabel })
                      : t("report.modalTitlePrefix", { entity })}
                  </h3>
                  <p className="text-xs text-stone-500">{t("report.safetyDesc")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label={t("report.ariaClose")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-stone-700">{t("report.reasonLabel")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                        category === c.value
                          ? "border-rose-300 bg-rose-50 text-rose-700"
                          : "border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      {t(c.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="report-reason" className="mb-1.5 block text-xs font-medium text-stone-700">
                  {t("report.detailsLabel")}
                </label>
                <textarea
                  id="report-reason"
                  required
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("report.detailsPlaceholder", { entity })}
                  className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
                <p className="mt-1 text-right text-[10px] text-stone-400">{reason.length}/1000</p>
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isPending ? t("report.submitting") : t("report.submitBtn")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
