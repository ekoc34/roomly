import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ReportCategory } from "@/types/database";

type Props = { listingId: string; isLoggedIn: boolean };

export function ReportListingButton({ listingId, isLoggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();
  const { t } = useLanguage();

  const CATEGORIES: { value: ReportCategory; label: string }[] = [
    { value: "scam",          label: t("report.catScam") },
    { value: "spam",          label: t("report.catSpam") },
    { value: "inappropriate", label: t("report.catInappropriate") },
    { value: "fake_photos",   label: t("report.catFakeListing") },
    { value: "duplicate",     label: t("report.catDuplicate") },
    { value: "other",         label: t("report.catOther") },
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = String(fd.get("category") ?? "other") as ReportCategory;
    const reason = String(fd.get("reason") ?? "").trim();
    if (!reason) { setError(t("report.errorRequired")); return; }
    if (reason.length > 1000) { setError(t("report.tooLong")); return; }
    startTransition(async () => {
      if (!supabase || !user) { setError(t("report.errorNotLoggedIn")); return; }
      const { error: err } = await supabase.from("listing_reports").insert({ listing_id: listingId, reporter_id: user.id, reason, category });
      if (err) {
        setError(err.code === "23505"
          ? t("report.errorDuplicate", { entity: t("report.entityListing") })
          : t("report.errorGeneral"));
        return;
      }
      setDone(true);
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-stone-400 hover:text-rose-600">
        {t("listing.report")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">{t("report.successTitle")}</h3>
                <p className="mt-2 text-sm text-stone-500">{t("report.successDesc")}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800"
                  data-testid="report-modal-close"
                >
                  {t("common.close")}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      {t("report.modalTitlePrefix", { entity: t("report.entityListing") })}
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">{t("report.safetyDesc")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-stone-400 hover:text-stone-600"
                    aria-label={t("report.ariaClose")}
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={onSubmit} className="mt-5 space-y-4" data-testid="report-form">
                  <div>
                    <label htmlFor="report-category" className="text-xs font-medium text-stone-700">
                      {t("report.reasonLabel")}
                    </label>
                    <select
                      id="report-category"
                      name="category"
                      defaultValue="scam"
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      data-testid="report-category-select"
                    >
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="report-reason" className="text-xs font-medium text-stone-700">
                      {t("report.detailsLabel")}
                    </label>
                    <textarea
                      id="report-reason"
                      name="reason"
                      required
                      maxLength={1000}
                      rows={4}
                      placeholder={t("report.detailsPlaceholder", { entity: t("report.entityListing") })}
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      data-testid="report-reason-input"
                    />
                  </div>
                  {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      data-testid="report-submit-button"
                      className="flex-1 rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-95"
                    >
                      {isPending ? t("report.submitting") : t("report.submitBtn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
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
      )}
    </>
  );
}
