/**
 * ResetPasswordPage — single source of truth for password recovery.
 *
 * Handles ALL recovery entry paths:
 *   Path 1 — PKCE code:      /wachtwoord-instellen?code=XXX
 *   Path 2 — OTP token_hash: /wachtwoord-instellen?token_hash=XXX&type=recovery
 *   Path 3 — Implicit hash:  /wachtwoord-instellen#access_token=XXX&type=recovery
 *   Path 4 — Event fallback: already-established recovery session (PASSWORD_RECOVERY event)
 *
 * This page NEVER redirects to the dashboard.
 * After a successful password update: sign out → redirect to /inloggen.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const RECOVERY_FLAG = "roomly_recovery_pending";

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // null = still detecting, true = ready to show form, false = invalid/expired
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  // Prevents double-resolution when multiple async paths complete.
  const resolvedRef = useRef(false);

  function resolve(ready: boolean) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (ready) {
      console.log("SESSION ESTABLISHED");
    }
    setSessionReady(ready);
  }

  useEffect(() => {
    console.log("RECOVERY PAGE LOADED");

    if (!supabase) {
      resolve(false);
      return;
    }

    const search = window.location.search;
    const hash   = window.location.hash;
    const sp     = new URLSearchParams(search);
    const hp     = hash ? new URLSearchParams(hash.slice(1)) : null;

    const code        = sp.get("code");
    const tokenHash   = sp.get("token_hash");
    const typeQuery   = sp.get("type");
    const accessToken  = hp?.get("access_token")  ?? "";
    const refreshToken = hp?.get("refresh_token") ?? "";

    // ── Path 1: PKCE code (?code=...) ────────────────────────────────────────
    // Supabase PKCE: redirectTo "https://www.welkthuis.nl/wachtwoord-instellen"
    // lands as /wachtwoord-instellen?code=XXXX
    if (code) {
      console.log("RECOVERY TOKENS DETECTED");
      // Strip code from URL immediately — prevents reuse on refresh.
      window.history.replaceState(null, "", window.location.pathname);

      // Subscribe BEFORE exchanging so PASSWORD_RECOVERY is never missed.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          subscription.unsubscribe();
          resolve(true);
        }
      });

      supabase.auth.exchangeCodeForSession(code).then(({ error: exchErr }) => {
        if (exchErr) {
          subscription.unsubscribe();
          resolve(false);
          return;
        }
        // Guard: if PASSWORD_RECOVERY hasn't fired within 3 s the code was not
        // a recovery code — treat as invalid rather than silently authorising.
        setTimeout(() => {
          subscription.unsubscribe();
          resolve(false);
        }, 3000);
      });

      return () => subscription.unsubscribe();
    }

    // ── Path 2: OTP token_hash (?token_hash=...&type=recovery) ───────────────
    // Supabase email-OTP / "magic link" recovery flow.
    if (tokenHash && typeQuery === "recovery") {
      console.log("RECOVERY TOKENS DETECTED");
      window.history.replaceState(null, "", window.location.pathname);

      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => resolve(!error));

      return;
    }

    // ── Path 3: Implicit hash (#access_token=...&type=recovery) ──────────────
    // Supabase implicit flow: bearer tokens in the URL fragment.
    // AuthCallbackPage forwards these here via window.location.replace.
    if (accessToken) {
      console.log("RECOVERY TOKENS DETECTED");
      window.history.replaceState(null, "", window.location.pathname);

      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => resolve(!error));

      return;
    }

    // ── Path 4: sessionStorage flag (legacy PasswordRecoveryHandler path) ────
    // PasswordRecoveryHandler may have already established a session and set
    // this flag before navigating here (e.g. legacy /auth/callback hash links).
    if (sessionStorage.getItem(RECOVERY_FLAG) === "1") {
      sessionStorage.removeItem(RECOVERY_FLAG);
      console.log("RECOVERY TOKENS DETECTED");
      resolve(true);
      return;
    }

    // ── Path 5: Event-based fallback ─────────────────────────────────────────
    // Catches: page refreshed mid-session, or session already established by
    // another mechanism. PASSWORD_RECOVERY fires from Supabase's session restore.
    const timeout = setTimeout(() => resolve(false), 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearTimeout(timeout);
        sessionStorage.removeItem(RECOVERY_FLAG);
        subscription.unsubscribe();
        resolve(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const fd       = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm  = String(fd.get("confirm")  ?? "");
    if (password.length < 8) { setFormError("Wachtwoord moet minimaal 8 tekens zijn."); return; }
    if (password !== confirm)  { setFormError("Wachtwoorden komen niet overeen."); return; }

    startTransition(async () => {
      if (!supabase) { setFormError("Supabase is niet geconfigureerd."); return; }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setFormError(err.message); return; }
      console.log("PASSWORD UPDATED");
      setDone(true);
      // Sign out so the user logs in fresh with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/inloggen"), 2500);
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
        <div className="text-center">
          <p className="text-3xl tracking-tight">
            <span className="font-semibold text-rose-500">Welkthuis</span>
            <span className="font-normal text-rose-500">.nl</span>
          </p>
          <h1 className="mt-2 text-xl font-bold text-stone-900">Nieuw wachtwoord instellen</h1>
          <p className="mt-1 text-sm text-stone-500">Kies een sterk nieuw wachtwoord.</p>
        </div>

        {done ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <svg className="mx-auto h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-emerald-800">Wachtwoord gewijzigd!</p>
            <p className="mt-1 text-xs text-emerald-700">Je wordt automatisch doorgestuurd naar inloggen…</p>
          </div>

        ) : sessionReady === null ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
            <p className="text-xs text-stone-400">Beveiligingslink wordt geverifieerd…</p>
          </div>

        ) : sessionReady === false ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-sm font-semibold text-amber-800">Ongeldige of verlopen link</p>
            <p className="mt-1 text-xs text-amber-700">
              De reset link is verlopen of al gebruikt. Vraag een nieuwe aan.
            </p>
            <Link
              href="/wachtwoord-vergeten"
              className="mt-4 inline-block rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600"
            >
              Nieuwe reset link aanvragen
            </Link>
          </div>

        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="rp-password" className="text-xs font-medium text-stone-700">
                Nieuw wachtwoord
              </label>
              <input
                id="rp-password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min. 8 tekens"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="text-xs font-medium text-stone-700">
                Herhaal wachtwoord
              </label>
              <input
                id="rp-confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Herhaal wachtwoord"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />
            </div>
            {formError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending ? "Opslaan…" : "Wachtwoord opslaan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
