import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  listingId: string;
};

export function ApplicationForm({ listingId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState<boolean | null>(null);
  const [listingOwnerId, setListingOwnerId] = useState<string | null>(null);
  const [listingTitle, setListingTitle] = useState<string>("");

  useEffect(() => {
    if (!user || !supabase) { setAlreadyApplied(false); return; }
    Promise.all([
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("listing_id", listingId).eq("applicant_id", user.id),
      supabase.from("listings").select("user_id, title").eq("id", listingId).maybeSingle(),
    ]).then(([{ count, error: appErr }, { data: listing, error: listingErr }]) => {
      if (appErr) console.error("[ApplicationForm] application count error:", appErr);
      if (listingErr) console.error("[ApplicationForm] listing fetch error:", listingErr);
      setAlreadyApplied((count ?? 0) > 0);
      setListingOwnerId((listing as { user_id: string } | null)?.user_id ?? null);
      setListingTitle((listing as { title: string } | null)?.title ?? "");
    });
  }, [listingId, user]);

  if (alreadyApplied === null) {
    return <div className="h-11 w-48 animate-pulse rounded-2xl bg-stone-200" />;
  }

  if (alreadyApplied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-3">
        <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-stone-600">Je hebt al gereageerd op deze woning.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Reactie verstuurd!</p>
          <p className="text-xs text-emerald-600">De verhuurder ontvangt jouw bericht zo snel mogelijk.</p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Reageer op deze woning
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !supabase) return;
    if (!message.trim()) {
      toast.error("Vul een bericht in voor je verstuurt.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: insertedApp, error: appError } = await supabase.from("applications").insert({
        listing_id: listingId,
        applicant_id: user.id,
        message: message.trim(),
        budget: budget ? parseFloat(budget) : null,
        status: "pending",
      }).select("id").single();
      if (appError) throw appError;

      if (insertedApp?.id) {
        const { error: notifError } = await supabase.rpc("notify_application_event", {
          p_application_id: insertedApp.id,
          p_event: "new_application",
        });
        if (notifError) {
          console.error("[ApplicationForm] notify_application_event failed:", notifError);
        }
      }

      setSubmitted(true);
      setAlreadyApplied(true);
      toast.success("Je reactie is verstuurd!");
    } catch (err) {
      console.error("[ApplicationForm] submit error:", err);
      toast.error("Er ging iets mis, probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-stone-900">Reageer op deze woning</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-stone-600">
          Jouw bericht <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Stel jezelf voor en vertel waarom jij de ideale huurder bent…"
          className="resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100"
          required
        />
        <p className="text-right text-xs text-stone-400">{message.length}/500</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-stone-600">
          Jouw budget <span className="text-stone-400">(optioneel)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-stone-400">€</span>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            min={0}
            step={50}
            placeholder="800"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-8 pr-4 text-sm text-stone-800 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-2xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
        >
          Annuleren
        </button>
        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="flex-1 rounded-2xl bg-rose-500 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? "Versturen…" : "Verstuur reactie"}
        </button>
      </div>
    </form>
  );
}
