import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function RegisterForm() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-amber-900">Supabase niet geconfigureerd</h2>
        <p className="mt-2 text-sm text-amber-800">Registreren is momenteel niet beschikbaar.</p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    try {
      const { error: signErr } = await supabase!.auth.signUp({ email, password });
      if (signErr) { setError("Registreren mislukt. Probeer een ander e-mailadres."); return; }
      const params = new URLSearchParams(searchString);
      const next = params.get("next");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/welkom";
      navigate(safe);
    } catch {
      setError("Er ging iets mis. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-5 rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm" data-testid="register-form">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Gratis account aanmaken</h1>
        <p className="mt-1 text-sm text-stone-500">Maak een gratis account aan om te reageren op woningen.</p>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">Wachtwoord</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" />
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60">
        {loading ? "Bezig…" : "Account aanmaken →"}
      </button>
      <p className="text-center text-sm text-stone-600">
        Al een account?{" "}
        <Link href="/inloggen" className="font-medium text-rose-600 hover:underline">Inloggen</Link>
      </p>
    </form>
  );
}
