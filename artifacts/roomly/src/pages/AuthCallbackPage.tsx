import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

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

    const run = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");
        const urlType = searchParams.get("type"); // "recovery" | "signup" | null

        // ── PKCE flow: ?code=... ────────────────────────────────
        if (code) {
          // ── Explicit recovery type in URL ──
          // Supabase appends ?type=recovery when the project is configured to
          // include it. Do NOT run the onboarding/email-verification flow here.
          if (urlType === "recovery") {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            window.history.replaceState(null, "", window.location.pathname);
            if (error) {
              setErrorMsg("De herstellink is ongeldig of verlopen.");
              setStatus("error");
              return;
            }
            sessionStorage.setItem("roomly_recovery_pending", "1");
            navigate("/wachtwoord-instellen");
            return;
          }

          // ── All other PKCE flows (signup confirmation, magic link) ──
          // Guard against recovery flows where Supabase omits ?type=recovery
          // from the callback URL (occurs in some project configurations). In
          // those cases, exchangeCodeForSession fires PASSWORD_RECOVERY
          // synchronously before the promise resolves; we capture it here to
          // prevent falling through to the email-verification path by mistake.
          let recoveryDetected = false;
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
              recoveryDetected = true;
            }
          });

          const { error } = await supabase.auth.exchangeCodeForSession(code);
          subscription.unsubscribe();

          if (error) {
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }

          if (recoveryDetected) {
            window.history.replaceState(null, "", window.location.pathname);
            sessionStorage.setItem("roomly_recovery_pending", "1");
            navigate("/wachtwoord-instellen");
            return;
          }

        } else {
          // ── Implicit / hash flow: #access_token=... ──────────
          const hash = window.location.hash;
          if (hash && hash.includes("access_token=")) {
            const params = new URLSearchParams(hash.slice(1));
            const hashType = params.get("type");
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token") ?? "";

            // ── Recovery via hash ──
            // Handle entirely here so we don't race against PasswordRecoveryHandler
            // reading the hash before we clear it with replaceState.
            if (hashType === "recovery") {
              if (!accessToken) {
                setErrorMsg("De herstellink is ongeldig of verlopen.");
                setStatus("error");
                return;
              }
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              window.history.replaceState(null, "", window.location.pathname);
              if (error) {
                setErrorMsg("De herstellink is ongeldig of verlopen.");
                setStatus("error");
                return;
              }
              sessionStorage.setItem("roomly_recovery_pending", "1");
              navigate("/wachtwoord-instellen");
              return;
            }

            if (!accessToken) {
              setErrorMsg("Verificatielink ongeldig of verlopen.");
              setStatus("error");
              return;
            }

            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              setErrorMsg("Verificatielink ongeldig of verlopen.");
              setStatus("error");
              return;
            }
          }
          // If no code and no hash, fall through — getUser below will
          // pick up an already-active session (e.g. OAuth redirect).
        }

        // Clean up URL
        window.history.replaceState(null, "", window.location.pathname);

        // ── Verify session and email confirmation ───────────────
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

        // ── Determine routing: onboarding vs dashboard ──────────
        // Only signup/email-verification flows reach this point.
        // Recovery flows have already returned above.
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.onboarding_completed) {
          // Signal to /welkom that it should show the verification success toast.
          sessionStorage.setItem("emailJustVerified", "1");
          navigate("/welkom");
        } else {
          navigate("/dashboard");
        }
      } catch {
        setErrorMsg("Er is een onverwachte fout opgetreden.");
        setStatus("error");
      }
    };

    run();
  }, [navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
        <p className="text-sm text-stone-500">E-mailadres wordt geverifieerd…</p>
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
