"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-amber-900">Supabase niet geconfigureerd</h2>
        <p className="mt-2 text-sm text-amber-800">
          Inloggen is momenteel niet beschikbaar omdat de database niet is geconfigureerd.
          Neem contact op met de beheerder.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        setError("Inloggen mislukt. Controleer e-mail en wachtwoord.");
        return;
      }
      const next = searchParams.get("next");
      const safe =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/dashboard";
      router.push(safe);
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
      method="post"
      action="?"
      className="mx-auto max-w-md space-y-5 rounded-2xl border border-stone-200/80 bg-white p-8 shadow-sm"
      data-testid="login-form"
    >
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Inloggen</h1>
        <p className="mt-1 text-sm text-stone-500">Log in om te reageren op woningen en chats te starten.</p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
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
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          Wachtwoord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-3 text-stone-900 shadow-sm focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-60"
      >
        {loading ? "Bezig…" : "Inloggen →"}
      </button>
      <p className="text-center text-sm text-stone-600">
        Nog geen account?{" "}
        <Link href="/registreren" className="font-medium text-rose-600 hover:underline">
          Maak gratis een account aan
        </Link>
      </p>
    </form>
  );
}
