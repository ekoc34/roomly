import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Props = { listingId: string };

export function ApplicationForm({ listingId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const message = String(fd.get("message") ?? "").trim();
    const budgetRaw = String(fd.get("budget") ?? "").trim();
    const availabilityText = String(fd.get("availability_text") ?? "").trim();

    if (!message || !availabilityText) { setError("Bericht en beschikbaarheid zijn verplicht."); return; }

    const budget = budgetRaw ? Number.parseFloat(budgetRaw.replace(",", ".")) : null;

    startTransition(async () => {
      if (!supabase || !user) { setError("Je moet ingelogd zijn om te reageren."); return; }
      const { error: err } = await supabase.from("applications").insert({
        listing_id: listingId,
        user_id: user.id,
        message,
        budget: budget && !Number.isNaN(budget) ? budget : null,
        availability_text: availabilityText,
        status: "pending",
      });
      if (err) {
        setError(err.code === "23505" ? "Je hebt al een aanvraag ingediend voor deze advertentie." : "Aanvraag kon niet worden verstuurd.");
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
        Je aanvraag is verstuurd. De adverteerder neemt contact met je op via Roomly.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Reageer op deze advertentie</h2>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-stone-700">Bericht</label>
        <textarea id="message" name="message" required rows={4} placeholder="Vertel kort wie je bent en waarom je interesse hebt." className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="budget" className="block text-sm font-medium text-stone-700">Budget (EUR per maand, optioneel)</label>
          <input id="budget" name="budget" type="text" inputMode="decimal" className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
        <div>
          <label htmlFor="availability_text" className="block text-sm font-medium text-stone-700">Beschikbaarheid</label>
          <input id="availability_text" name="availability_text" type="text" required placeholder="bijv. per 1 september" className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
        </div>
      </div>
      <button type="submit" disabled={isPending} className="w-full rounded-2xl bg-rose-500 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60 active:scale-[0.98]">
        {isPending ? "Versturen..." : "Stuur aanvraag →"}
      </button>
    </form>
  );
}
