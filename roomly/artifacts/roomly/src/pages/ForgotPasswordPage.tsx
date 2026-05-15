import { useState, useTransition } from "react";
import { Link } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    if (!email) { setError("Vul je e-mailadres in."); return; }
    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/wachtwoord-instellen`,
      });
      if (err) { setError(err.message); return; }
      setSent(true);
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
        <div className="text-center">
          <p className="text-3xl font-black text-rose-600">Roomly</p>
          <h1 className="mt-2 text-xl font-bold text-stone-900">Wachtwoord vergeten?</h1>
          <p className="mt-1 text-sm text-stone-500">
            Vul je e-mailadres in en wij sturen je een reset link.
          </p>
        </div>

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <svg className="mx-auto h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-emerald-800">Check je e-mail!</p>
            <p className="mt-1 text-xs text-emerald-700">
              We hebben een reset link gestuurd. Controleer ook je spam-map.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="fp-email" className="text-xs font-medium text-stone-700">E-mailadres</label>
              <input
                id="fp-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jij@example.nl"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending || !isSupabaseConfigured()}
              className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Versturen…" : "Reset link versturen"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-stone-500">
          <Link href="/inloggen" className="font-medium text-rose-600 hover:underline">← Terug naar inloggen</Link>
        </p>
      </div>
    </div>
  );
}
