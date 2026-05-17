import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const RECOVERY_FLAG = "roomly_recovery_pending";

export function PasswordRecoveryHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // ── Hash-based detection ──────────────────────────────────────────────────
    // Supabase implicit flow: the email link lands as
    //   /auth/callback#access_token=...&type=recovery
    // or (legacy) directly at the site root with a hash.
    // Supabase clears window.location.hash asynchronously via replaceState, so
    // on the first synchronous tick the hash is still present.
    //
    // If the user is already on /wachtwoord-instellen (e.g. redirectTo now
    // points there directly), let ResetPasswordPage handle the hash itself —
    // navigating away and back would unmount it mid-exchange.
    const hash = window.location.hash;
    const alreadyOnResetPage = window.location.pathname.includes("wachtwoord-instellen");

    if (
      hash.includes("type=recovery") &&
      hash.includes("access_token=") &&
      !alreadyOnResetPage
    ) {
      sessionStorage.setItem(RECOVERY_FLAG, "1");
      setLocation("/wachtwoord-instellen");
      return;
    }

    // ── Event-based detection ─────────────────────────────────────────────────
    // Fires for PKCE flows where the SDK exchanges a code server-side and
    // emits PASSWORD_RECOVERY once the session is established.
    //
    // Guard: if already on /wachtwoord-instellen, ResetPasswordPage is handling
    // the flow — do NOT navigate again (would cause a re-mount and lose state).
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_FLAG, "1");
        if (!window.location.pathname.includes("wachtwoord-instellen")) {
          setLocation("/wachtwoord-instellen");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setLocation]);

  return null;
}
