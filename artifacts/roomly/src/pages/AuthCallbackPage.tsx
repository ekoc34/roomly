/**
 * AuthCallbackPage — OAuth login callbacks ONLY.
 *
 * This page handles ONLY OAuth sign-in / email-verification code exchanges.
 * Password recovery is handled exclusively by ResetPasswordPage (/wachtwoord-instellen).
 * ForgotPasswordPage sends redirectTo: "https://www.welkthuis.nl/wachtwoord-instellen"
 * so recovery codes never arrive here.
 */
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
        const search = window.location.search;
        const hash   = window.location.hash;
        const sp     = new URLSearchParams(search);
        const code   = sp.get("code");
        const urlType = sp.get("type");

        const hashParams = hash ? new URLSearchParams(hash.slice(1)) : null;
        const hashType   = hashParams?.get("type");

        // PKCE code exchange (OAuth sign-in / email verification)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
        } else if (hash && hashParams?.get("access_token")) {
          // Implicit flow — magic-link / email sign-in tokens in the hash
          const accessToken  = hashParams.get("access_token") ?? "";
          const refreshToken = hashParams.get("refresh_token") ?? "";
          if (!accessToken) {
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          });
          window.history.replaceState(null, "", window.location.pathname);
          if (error) {
            setErrorMsg("Verificatielink ongeldig of verlopen.");
            setStatus("error");
            return;
          }
        }

        // Determine where to send the user
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
