/**
 * ResetPasswordPage — single source of truth for password recovery.
 *
 * Handles ALL recovery entry paths:
 *   Path 1 — PKCE code:      /wachtwoord-instellen?code=XXX
 *   Path 2 — OTP token_hash: /wachtwoord-instellen?token_hash=XXX&type=recovery
 *   Path 3 — Implicit hash:  /wachtwoord-instellen#access_token=XXX&type=recovery
 *   Path 4 — Event fallback: PASSWORD_RECOVERY event (session already established)
 *
 * This page NEVER redirects to the dashboard.
 * After a successful password update: sign out → redirect to /inloggen after 2s.
 *
 * Diagnostics emitted to console:
 *   RECOVERY PAGE LOADED
 *   RECOVERY TOKENS FOUND
 *   EXCHANGING RECOVERY SESSION
 *   PASSWORD_RECOVERY EVENT RECEIVED
 *   PASSWORD UPDATED SUCCESSFULLY
 *   RECOVERY FAILED
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // null = still detecting, true = ready to show form, false = invalid/expired
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  // Prevents double-resolution when multiple async paths complete concurrently.
  const resolvedRef = useRef(false);

  function resolve(ready: boolean) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (ready) {
      console.log("[RECOVERY] SESSION ESTABLISHED — showing password form");
    } else {
      console.log("[RECOVERY] RECOVERY FAILED — invalid or expired link");
    }
    setSessionReady(ready);
  }

  useEffect(() => {
    console.log("[RECOVERY] RECOVERY PAGE LOADED");

    if (!supabase) {
      console.log("[RECOVERY] RECOVERY FAILED — Supabase not configured");
      resolve(false);
      return;
    }

    const search = window.location.search;
    const hash   = window.location.hash;
    const sp     = new URLSearchParams(search);
    const hp     = hash ? new URLSearchParams(hash.slice(1)) : null;

    const code         = sp.get("code");
    const tokenHash    = sp.get("token_hash");
    const typeQuery    = sp.get("type");
    const accessToken  = hp?.get("access_token")  ?? "";
    const refreshToken = hp?.get("refresh_token") ?? "";
    const hashType     = hp?.get("type") ?? "";

    // ── Path 1: PKCE code (?code=...) ────────────────────────────────────────
    // ForgotPasswordPage uses redirectTo "https://www.welkthuis.nl/wachtwoord-instellen"
    // so Supabase delivers the PKCE code here as /wachtwoord-instellen?code=XXX
    if (code) {
      console.log("[RECOVERY] RECOVERY TOKENS FOUND — PKCE code detected");
      // Strip code from URL immediately to prevent reuse on refresh.
      window.history.replaceState(null, "", window.location.pathname);

      console.log("[RECOVERY] EXCHANGING RECOVERY SESSION");

      supabase.auth.exchangeCodeForSession(code).then(({ error: exchErr }) => {
        if (exchErr) {
          console.log("[RECOVERY] RECOVERY FAILED — code exchange error:", exchErr.message);
          resolve(false);
          return;
        }
        // Exchange succeeded. The session is now active.
        // We resolve(true) immediately — we don't wait for the PASSWORD_RECOVERY
        // event because it may have already fired before our listener was ready,
        // or may not fire at all on some Supabase SDK versions.
        console.log("[RECOVERY] PASSWORD_RECOVERY EVENT RECEIVED (via code exchange)");
        resolve(true);
      });

      // Also listen for the explicit PASSWORD_RECOVERY event as a belt-and-suspenders
      // path in case the promise hasn't resolved yet.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          console.log("[RECOVERY] PASSWORD_RECOVERY EVENT RECEIVED (auth state change)");
          subscription.unsubscribe();
          resolve(true);
        }
      });

      return () => subscription.unsubscribe();
    }

    // ── Path 2: OTP token_hash (?token_hash=...&type=recovery) ───────────────
    // Supabase email-OTP / "magic link" recovery flow.
    if (tokenHash && typeQuery === "recovery") {
      console.log("[RECOVERY] RECOVERY TOKENS FOUND — token_hash detected");
      // Strip from URL to prevent reuse.
      window.history.replaceState(null, "", window.location.pathname);

      console.log("[RECOVERY] EXCHANGING RECOVERY SESSION");
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            console.log("[RECOVERY] RECOVERY FAILED — verifyOtp error:", error.message);
            resolve(false);
          } else {
            console.log("[RECOVERY] PASSWORD_RECOVERY EVENT RECEIVED (via token_hash)");
            resolve(true);
          }
        });

      return;
    }

    // ── Path 3: Implicit hash (#access_token=...&type=recovery) ──────────────
    // Arrives here when PasswordRecoveryHandler forwards an unexpected hash,
    // or when an old-style implicit-flow recovery link lands directly.
    if (accessToken && (hashType === "recovery" || hash.includes("type=recovery"))) {
      console.log("[RECOVERY] RECOVERY TOKENS FOUND — implicit hash token detected");
      // Strip the hash immediately.
      window.history.replaceState(null, "", window.location.pathname);

      console.log("[RECOVERY] EXCHANGING RECOVERY SESSION");
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            console.log("[RECOVERY] RECOVERY FAILED — setSession error:", error.message);
            resolve(false);
          } else {
            console.log("[RECOVERY] PASSWORD_RECOVERY EVENT RECEIVED (via implicit hash)");
            resolve(true);
          }
        });

      return;
    }

    // ── Path 4: Event-based fallback ─────────────────────────────────────────
    // Catches edge cases:
    //   • Page refreshed while a recovery session is active
    //   • A recovery session was established by another tab / mechanism
    //   • SDK restores session and emits PASSWORD_RECOVERY on init
    //
    // We give Supabase 5 seconds to emit PASSWORD_RECOVERY. If nothing fires
    // we treat the URL as an invalid/stale link.
    console.log("[RECOVERY] No tokens in URL — waiting for PASSWORD_RECOVERY event…");

    const timeout = setTimeout(() => {
      console.log("[RECOVERY] RECOVERY FAILED — timeout waiting for PASSWORD_RECOVERY");
      resolve(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("[RECOVERY] PASSWORD_RECOVERY EVENT RECEIVED (event fallback)");
        clearTimeout(timeout);
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

    if (password.length < 8) {
      setFormError("Wachtwoord moet minimaal 8 tekens zijn.");
      return;
    }
    if (password !== confirm) {
      setFormError("Wachtwoorden komen niet overeen.");
      return;
    }

    startTransition(async () => {
      if (!supabase) {
        setFormError("Supabase is niet geconfigureerd.");
        return;
      }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        console.log("[RECOVERY] RECOVERY FAILED — updateUser error:", err.message);
        setFormError(err.message);
        return;
      }
      console.log("[RECOVERY] PASSWORD UPDATED SUCCESSFULLY");
      setDone(true);
      // Sign out so the user starts a fresh session with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/inloggen"), 2000);
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
            <p className="mt-1 text-xs text-emerald-700">Je wordt over 2 seconden doorgestuurd naar inloggen…</p>
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
