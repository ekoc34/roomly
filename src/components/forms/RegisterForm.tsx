"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens zijn.");
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (signErr) {
        setError(signErr.message || "Registratie mislukt.");
        return;
      }
      setInfo(
        "Controleer je inbox om je e-mail te bevestigen (indien verplicht door je project). Daarna kun je inloggen.",
      );
      router.refresh();
    } catch {
      setError("Er ging iets mis. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-md space-y-5 rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Account aanmaken</h1>
        <p className="mt-1 text-sm text-stone-500">
          Start met zoeken of adverteren op Roomly.
        </p>
      </div>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {info}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-stone-700"
        >
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
        <p className="mt-1 text-xs text-stone-500">Minimaal 8 tekens.</p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60"
      >
        {loading ? "Bezig…" : "Registreren"}
      </button>
      <p className="text-center text-sm text-stone-600">
        Heb je al een account?{" "}
        <Link href="/inloggen" className="font-medium text-rose-600 hover:underline">
          Inloggen
        </Link>
      </p>
    </form>
  );
}
