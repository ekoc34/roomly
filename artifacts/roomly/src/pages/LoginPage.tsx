import { useState, useTransition, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useSearch } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/hooks/useAuth";
import { checkRateLimit, recordAttempt, formatRetryTime, RL } from "@/lib/rateLimiter";

export function LoginPage() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const searchStr = useSearch();
  const nextParam = new URLSearchParams(searchStr).get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

  useEffect(() => {
    if (!authLoading && user) navigate(nextParam);
  }, [user, authLoading, navigate, nextParam]);

  if (!authLoading && user) return null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) { setError("Vul je e-mail en wachtwoord in."); return; }

    const rl = checkRateLimit(RL.login.key, RL.login.max, RL.login.windowMs);
    if (!rl.allowed) {
      setError(`Te veel inlogpogingen. Probeer het over ${formatRetryTime(rl.retryAfterMs)} opnieuw.`);
      return;
    }
    recordAttempt(RL.login.key, RL.login.windowMs);

    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message === "Invalid login credentials" ? "Onjuist e-mailadres of wachtwoord." : err.message); return; }

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

  const signInWithOAuth = async (provider: "google" | "facebook") => {
    if (!supabase) { setOauthError("Supabase is niet geconfigureerd."); return; }
    setOauthError(null);
    setOauthLoading(provider);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${nextParam}`,
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
              {oauthLoading === "google" ? "Bezig…" : "Doorgaan met Google"}
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
              {oauthLoading === "facebook" ? "Bezig…" : "Doorgaan met Facebook"}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs text-stone-400">of</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-stone-700">E-mailadres</label>
              <input id="email" name="email" type="email" required autoComplete="email" data-testid="login-email" className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200" placeholder="jij@example.nl" />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-medium text-stone-700">Wachtwoord</label>
              <div className="mt-1.5">
                <PasswordInput id="password" name="password" required autoComplete="current-password" data-testid="login-password" placeholder="••••••••" />
              </div>
              <div className="mt-1.5 flex justify-end">
                <Link href="/wachtwoord-vergeten" className="text-xs text-stone-400 hover:text-stone-600 transition-colors min-h-[1.75rem] inline-flex items-center">Wachtwoord vergeten?</Link>
              </div>
            </div>
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button type="submit" disabled={isPending || !isSupabaseConfigured()} data-testid="login-submit" className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]">
              {isPending ? "Inloggen…" : "Inloggen"}
            </button>
            <p className="text-center text-xs text-stone-400">
              Ons{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-stone-600">privacybeleid</Link>{" "}
              is van toepassing.
            </p>
          </form>
          <p className="mt-3 text-center text-sm text-stone-500">
            Nog geen account?{" "}
            <Link href={nextParam !== "/dashboard" ? `/registreren?next=${encodeURIComponent(nextParam)}` : "/registreren"} data-testid="login-register-link" className="font-medium text-rose-600 hover:underline">Aanmelden →</Link>
          </p>
        </div>
      </div>
    </>
  );
}
