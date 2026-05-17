import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

function recoveryErrorMessage(msg: string): string {
  if (/rate.limit|too many|for security purposes|email.*limit|over_email/i.test(msg)) {
    return "Te veel aanvragen. Probeer het over een uur opnieuw.";
  }
  return "De herstellink is ongeldig of verlopen.";
}

type Status = "loading" | "error";

export function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!supabase) {
      setErrorMsg("Supabase is niet geconfigureerd.");
      setStatus("error");
      return;
    }

    // ── RECOVERY DETECTION — must happen SYNCHRONOUSLY before any await ───────
    //
    // Supabase JS fires onAuthStateChange with the CURRENT auth state immediately
    // when you subscribe. If the SDK auto-processed a recovery hash at page load
    // (implicit flow), the state is already PASSWORD_RECOVERY by the time this
    // effect runs — so subscribing here catches it instantly, before any await.
    //
    // For PKCE recovery codes, the event fires synchronously DURING the
    // exchangeCodeForSession call, so the flag is set before that promise resolves.
    let recoveryDetected = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryDetected = true;
      }
    });

    const run = async () => {
      try {
        // ── Parse URL signals ─────────────────────────────────────────────────
        const searchParams = new URLSearchParams(window.location.search);
        const code    = searchParams.get("code");
        const urlType = searchParams.get("type"); // "recovery" | "signup" | null

        const hash       = window.location.hash;
        const hashParams = hash ? new URLSearchParams(hash.slice(1)) : null;
        const hashType   = hashParams?.get("type");

        // ── RECOVERY — handled as absolute first priority ─────────────────────
        //
        // We arrive here via one of three paths:
        //   A) urlType === "recovery"  — PKCE, type in query string
        //   B) hashType === "recovery" — implicit flow, type in hash
        //   C) recoveryDetected        — PKCE with no type in URL, but SDK fired
        //                               PASSWORD_RECOVERY during exchangeCodeForSession
        //
        // None of these paths call getUser(), check profiles, or set emailJustVerified.

        if (urlType === "recovery" && code) {
          // Path A — PKCE with explicit type
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          subscription.unsubscribe();
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            setErrorMsg(recoveryErrorMessage(error.message));
            setStatus("error");
            return;
          }
          sessionStorage.setItem("roomly_recovery_pending", "1");
          navigate("/wachtwoord-instellen");
          return;
        }

        if (hashType === "recovery") {
          // Path B — implicit / hash flow
          const accessToken  = hashParams?.get("access_token") ?? "";
          const refreshToken = hashParams?.get("refresh_token") ?? "";
          if (!accessToken) {
            subscription.unsubscribe();
            setErrorMsg("De herstellink is ongeldig of verlopen.");
            setStatus("error");
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          subscription.unsubscribe();
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            setErrorMsg(recoveryErrorMessage(error.message));
            setStatus("error");
            return;
          }
          sessionStorage.setItem("roomly_recovery_pending", "1");
          navigate("/wachtwoord-instellen");
          return;
        }

        // ── Non-recovery PKCE code exchange ───────────────────────────────────
        // For PKCE recovery codes where Supabase omits ?type=recovery, the SDK
        // fires PASSWORD_RECOVERY synchronously during exchangeCodeForSession,
        // setting recoveryDetected = true before the await resolves.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (recoveryDetected) {
            // Path C — recovery detected via event during code exchange
            subscription.unsubscribe();
            window.history.replaceState(null, "", window.location.pathname);
            if (error) {
              setErrorMsg(recoveryErrorMessage(error.message));
              setStatus("error");
              return;
            }
            sessionStorage.setItem("roomly_recovery_pending", "1");
            navigate("/wachtwoord-instellen");
            return;
          }

          if (error) {
            subscription.unsubscribe();
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
        } else if (hash && hash.includes("access_token=")) {
          // ── Implicit flow — non-recovery (signup confirmation, magic link) ──
          const accessToken  = hashParams?.get("access_token") ?? "";
          const refreshToken = hashParams?.get("refresh_token") ?? "";
          if (!accessToken) {
            subscription.unsubscribe();
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            subscription.unsubscribe();
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
        }
        // No code, no hash → fall through; getUser picks up an existing session.

        subscription.unsubscribe();

        // ── Clean up URL ──────────────────────────────────────────────────────
        window.history.replaceState(null, "", window.location.pathname);

        // ── Email-verification flow (signup / magic link only) ────────────────
        // Only reachable when NO recovery signal was detected above.
        const { data: { user }, error: userErr } = await supabase.auth.getUser();

        if (userErr || !user) {
          setErrorMsg("Verificatie mislukt. Probeer de link opnieuw.");
          setStatus("error");
          return;
        }

        if (!user.email_confirmed_at) {
          setErrorMsg("Je e-mailadres is nog niet bevestigd.");
          setStatus("error");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.onboarding_completed) {
          // Only flag the email-verified toast for genuine email-signup links.
          // OAuth sign-ins (Google/Facebook) also land here when Supabase uses a
          // PKCE ?code= callback, but they have no urlType and their provider is
          // not "email". OAuthProfileHandler sets oauthNewUser for those users.
          const isEmailSignupLink =
            (urlType === "signup" || hashType === "signup") &&
            user.app_metadata?.provider === "email";
          if (isEmailSignupLink) {
            sessionStorage.setItem("emailJustVerified", "1");
          }
          navigate("/welkom");
        } else {
          navigate("/dashboard");
        }
      } catch {
        subscription.unsubscribe();
        setErrorMsg("Er is een onverwachte fout opgetreden.");
        setStatus("error");
      }
    };

    run();

    // Cleanup in case the component unmounts before run() completes.
    return () => { subscription.unsubscribe(); };
  }, [navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
        <p className="text-sm text-stone-500">Link wordt verwerkt…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
          <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-stone-900">Verificatie mislukt</h1>
        <p className="text-sm text-stone-500">{errorMsg}</p>
        <a
          href="/inloggen"
          className="mt-2 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]"
        >
          Terug naar inloggen
        </a>
      </div>
    </div>
  );
}
