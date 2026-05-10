import { useState, useTransition } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PasswordInput } from "@/components/ui/password-input";

export function RegisterPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) { setError("Wachtwoorden komen niet overeen."); return; }
    if (password.length < 8) { setError("Wachtwoord moet minimaal 8 tekens zijn."); return; }
    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (err) { setError(err.message); return; }
      if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, email, name, role: "student", user_type: "tenant", phone_verified: false, email_auto_verified: false, student_verified: false });
      }
      navigate("/welkom");
    });
  };

  const signInWithOAuth = async (provider: "google" | "facebook") => {
    if (!supabase) { setOauthError("Supabase is niet geconfigureerd."); return; }
    setOauthError(null);
    setOauthLoading(provider);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (err) {
      setOauthError(
        provider === "google"
          ? "Kon niet inloggen met Google."
          : "Kon niet inloggen met Facebook."
      );
      setOauthLoading(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Account aanmaken — Welkthuis</title>
        <meta name="description" content="Maak gratis een Welkthuis account aan en zoek jouw perfecte kamer of woning in Nederland." />
      </Helmet>
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
          <div className="text-center">
            <p className="text-3xl font-black text-rose-600">Welkthuis</p>
            <h1 className="mt-2 text-xl font-bold text-stone-900">Account aanmaken</h1>
            <p className="mt-1 text-sm text-stone-500">Gratis — altijd</p>
          </div>
          {!isSupabaseConfigured() && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Supabase is niet geconfigureerd. Voeg <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> en <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> toe als omgevingsvariabelen.
            </div>
          )}

          <div className="mt-6 space-y-3">
            {oauthError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{oauthError}</p>
            )}
            <button
              type="button"
              onClick={() => signInWithOAuth("google")}
              disabled={!!oauthLoading || !isSupabaseConfigured()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50 active:scale-[0.98]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {oauthLoading === "google" ? "Bezig…" : "Aanmelden met Google"}
            </button>

            <button
              type="button"
              onClick={() => signInWithOAuth("facebook")}
              disabled={!!oauthLoading || !isSupabaseConfigured()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: "#1877F2" }}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
              {oauthLoading === "facebook" ? "Bezig…" : "Aanmelden met Facebook"}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs text-stone-400">of</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
            <div>
              <label htmlFor="reg-name" className="text-xs font-medium text-stone-700">Naam</label>
              <input id="reg-name" name="name" type="text" required data-testid="register-name" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="Voornaam Achternaam" />
            </div>
            <div>
              <label htmlFor="reg-email" className="text-xs font-medium text-stone-700">E-mailadres</label>
              <input id="reg-email" name="email" type="email" required autoComplete="email" data-testid="register-email" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="jij@example.nl" />
            </div>
            <div>
              <label htmlFor="reg-password" className="text-xs font-medium text-stone-700">Wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput id="reg-password" name="password" required minLength={8} data-testid="register-password" placeholder="Min. 8 tekens" autoComplete="new-password" />
              </div>
            </div>
            <div>
              <label htmlFor="reg-confirm" className="text-xs font-medium text-stone-700">Herhaal wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput id="reg-confirm" name="confirm" required minLength={8} data-testid="register-confirm" placeholder="Herhaal wachtwoord" autoComplete="new-password" />
              </div>
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={isPending || !isSupabaseConfigured()} data-testid="register-submit" className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
              {isPending ? "Bezig…" : "Account aanmaken"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-stone-500">
            Al een account?{" "}
            <Link href="/inloggen" data-testid="register-login-link" className="font-medium text-rose-600 hover:underline">Inloggen →</Link>
          </p>
        </div>
      </div>
    </>
  );
}
