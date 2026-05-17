import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const RECOVERY_FLAG = "roomly_recovery_pending";

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // null = checking, true = valid recovery session, false = invalid/expired
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  // Prevents multiple state updates when several auth events fire at once.
  const resolvedRef = useRef(false);

  useEffect(() => {
    // ── Path 1: Flag set by PasswordRecoveryHandler (hash implicit flow) ─────
    // PasswordRecoveryHandler detects a legacy #access_token=...&type=recovery
    // hash before this component mounts, sets the flag, and navigates here.
    if (sessionStorage.getItem(RECOVERY_FLAG) === "1") {
      sessionStorage.removeItem(RECOVERY_FLAG);
      resolvedRef.current = true;
      setSessionReady(true);
      return;
    }

    if (!supabase) {
      setSessionReady(false);
      return;
    }

    // ── Path 2: PKCE code arrived directly at this page (?code=...) ──────────
    // Supabase PKCE flow: resetPasswordForEmail with
    //   redirectTo: "https://www.welkthuis.nl/wachtwoord-instellen"
    // causes the email link to land here as
    //   /wachtwoord-instellen?code=XXXX
    // We exchange the code ourselves and wait for the PASSWORD_RECOVERY event.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      // Strip the code from the URL immediately — prevents reuse on refresh.
      window.history.replaceState(null, "", window.location.pathname);

      // Subscribe BEFORE calling exchangeCodeForSession so we never miss the
      // PASSWORD_RECOVERY event even if it fires synchronously.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" && !resolvedRef.current) {
          resolvedRef.current = true;
          sessionStorage.removeItem(RECOVERY_FLAG);
          subscription.unsubscribe();
          setSessionReady(true);
        }
      });

      supabase.auth.exchangeCodeForSession(code).then(({ error: exchErr }) => {
        if (exchErr && !resolvedRef.current) {
          subscription.unsubscribe();
          setSessionReady(false);
          return;
        }
        // If PASSWORD_RECOVERY hasn't fired within 3 s after the exchange
        // completes, the code was not for a recovery session — treat as invalid.
        setTimeout(() => {
          if (!resolvedRef.current) {
            subscription.unsubscribe();
            setSessionReady(false);
          }
        }, 3000);
      });

      return () => subscription.unsubscribe();
    }

    // ── Path 3: Hash-based implicit recovery token landed directly here ───────
    // Belt-and-suspenders: PasswordRecoveryHandler normally catches this first
    // (when coming from /auth/callback or legacy links), but if the hash is
    // present here we handle it directly.
    const hash = window.location.hash;
    if (hash.includes("access_token=") && hash.includes("type=recovery")) {
      const hp = new URLSearchParams(hash.slice(1));
      const accessToken  = hp.get("access_token")  ?? "";
      const refreshToken = hp.get("refresh_token") ?? "";
      window.history.replaceState(null, "", window.location.pathname);
      if (!accessToken) {
        setSessionReady(false);
        return;
      }
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: sessErr }) => {
          if (!resolvedRef.current) {
            resolvedRef.current = true;
            setSessionReady(sessErr ? false : true);
          }
        });
      return;
    }

    // ── Path 4: Event-based fallback ──────────────────────────────────────────
    // Catches edge cases: e.g. user refreshed mid-recovery, or a legacy
    // /auth/callback flow that already exchanged the code and navigated here.
    // The PASSWORD_RECOVERY event fires from Supabase's internal session restore.
    const timeout = setTimeout(() => {
      if (!resolvedRef.current) setSessionReady(false);
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !resolvedRef.current) {
        clearTimeout(timeout);
        resolvedRef.current = true;
        sessionStorage.removeItem(RECOVERY_FLAG);
        subscription.unsubscribe();
        setSessionReady(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm  = String(fd.get("confirm")  ?? "");
    if (password.length < 8) { setError("Wachtwoord moet minimaal 8 tekens zijn."); return; }
    if (password !== confirm) { setError("Wachtwoorden komen niet overeen."); return; }
    startTransition(async () => {
      if (!supabase) { setError("Supabase is niet geconfigureerd."); return; }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(err.message); return; }
      setDone(true);
      // Sign out after a successful reset so the user logs in fresh with their
      // new password, confirming it works.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/inloggen"), 2500);
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md">
        <div className="text-center">
          <p className="text-3xl tracking-tight"><span className="font-semibold text-rose-500">Welkthuis<span className="font-normal text-rose-500">.nl</span></span></p>
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
          <div className="mt-8 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
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
              <label htmlFor="rp-password" className="text-xs font-medium text-stone-700">Nieuw wachtwoord</label>
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
              <label htmlFor="rp-confirm" className="text-xs font-medium text-stone-700">Herhaal wachtwoord</label>
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
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
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
