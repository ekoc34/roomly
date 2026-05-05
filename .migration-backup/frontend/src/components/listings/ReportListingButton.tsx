"use client";

import { useState, useTransition } from "react";
import { reportListing } from "@/app/actions/reports";

type Props = {
  listingId: string;
  isLoggedIn: boolean;
};

const CATEGORIES: { value: string; label: string }[] = [
  { value: "scam", label: "Oplichting / scam" },
  { value: "fake_photos", label: "Foto's lijken vals/gestolen" },
  { value: "spam", label: "Spam / commercieel" },
  { value: "inappropriate", label: "Ongepaste inhoud" },
  { value: "duplicate", label: "Dubbele advertentie" },
  { value: "other", label: "Iets anders" },
];

export function ReportListingButton({ listingId, isLoggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await reportListing(listingId, formData);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  };

  if (!isLoggedIn) {
    return (
      <a
        href={`/inloggen?next=/kamers/${listingId}`}
        className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-rose-600 hover:underline"
        data-testid="report-listing-link"
      >
        Advertentie melden
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="report-listing-button"
        className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-rose-600 hover:underline"
      >
        Advertentie melden
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          data-testid="report-modal"
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-stone-900">Bedankt voor je melding</h3>
                <p className="mt-2 text-sm text-stone-500">
                  We bekijken deze advertentie zo snel mogelijk en nemen actie als nodig.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-2xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800"
                  data-testid="report-modal-close"
                >
                  Sluiten
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">
                      Advertentie melden
                    </h3>
                    <p className="mt-1 text-sm text-stone-500">
                      Help ons Roomly veilig te houden.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-stone-400 hover:text-stone-600"
                    aria-label="Sluiten"
                  >
                    ✕
                  </button>
                </div>

                <form action={onSubmit} className="mt-5 space-y-4" data-testid="report-form">
                  <div>
                    <label htmlFor="report-category" className="text-xs font-medium text-stone-700">
                      Categorie
                    </label>
                    <select
                      id="report-category"
                      name="category"
                      defaultValue="scam"
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      data-testid="report-category-select"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="report-reason" className="text-xs font-medium text-stone-700">
                      Toelichting
                    </label>
                    <textarea
                      id="report-reason"
                      name="reason"
                      required
                      maxLength={1000}
                      rows={4}
                      placeholder="Waarom meld je deze advertentie?"
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
                      {isPending ? "Versturen..." : "Verstuur melding"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Annuleren
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
