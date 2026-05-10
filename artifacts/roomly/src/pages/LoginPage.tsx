import { useState, useTransition } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useSearch } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginPage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const nextParam = new URLSearchParams(searchStr).get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) { setError("Vul je e-mail en wachtwoord in."); return; }
    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message === "Invalid login credentials" ? "Onjuist e-mailadres of wachtwoord." : err.message); return; }

      // Check if the account has been soft-deleted
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("deleted_at")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profile?.deleted_at) {
          await supabase.auth.signOut();
          setError("Dit account is verwijderd en kan niet meer worden gebruikt.");
          return;
        }
      }

      navigate(nextParam);
    });
  };

  return (
    <>
      <Helmet>
        <title>Inloggen — Welkthuis.nl</title>
        <meta name="description" content="Log in op je Welkthuis.nl account en vind jouw perfecte woning in Nederland." />
      </Helmet>
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
          <div className="text-center">
            <p className="text-3xl tracking-tight"><span className="font-semibold text-rose-500">Welkthuis<span className="font-normal text-rose-500">.nl</span></span></p>
            <h1 className="mt-2 text-xl font-bold text-stone-900">Welkom terug</h1>
            <p className="mt-1 text-sm text-stone-500">Log in op je account</p>
          </div>
          {!isSupabaseConfigured() && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supabase is niet geconfigureerd. Voeg <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> en <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> toe als omgevingsvariabelen.
            </div>
          )}
          <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="login-form">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-stone-700">E-mailadres</label>
              <input id="email" name="email" type="email" required autoComplete="email" data-testid="login-email" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="jij@example.nl" />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-stone-700">Wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput id="password" name="password" required autoComplete="current-password" data-testid="login-password" placeholder="••••••••" />
              </div>
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={isPending || !isSupabaseConfigured()} data-testid="login-submit" className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
              {isPending ? "Inloggen…" : "Inloggen"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link href="/wachtwoord-vergeten" className="text-stone-500 hover:text-rose-600 hover:underline">Wachtwoord vergeten?</Link>
          </p>
          <p className="mt-3 text-center text-sm text-stone-500">
            Nog geen account?{" "}
            <Link href="/registreren" data-testid="login-register-link" className="font-medium text-rose-600 hover:underline">Aanmelden →</Link>
          </p>
        </div>
      </div>
    </>
  );
}
