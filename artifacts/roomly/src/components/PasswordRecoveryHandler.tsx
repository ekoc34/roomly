import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const RECOVERY_FLAG = "roomly_recovery_pending";

export function PasswordRecoveryHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // ── Hash-based detection (runs before Supabase clears the hash) ──────────
    // Supabase clears window.location.hash asynchronously via replaceState, so
    // on the first synchronous useEffect tick the hash is still present.
    // This handles the common case where the user lands on /#access_token=...
    // &type=recovery because the Supabase email template uses {{ .SiteURL }}/#.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") && hash.includes("access_token=")) {
      sessionStorage.setItem(RECOVERY_FLAG, "1");
      setLocation("/wachtwoord-instellen");
      return;
    }

    // ── Event-based detection (fallback for PKCE / server-side code exchange) ─
    // When Supabase uses a code query param instead of a hash, it exchanges the
    // code server-side and fires PASSWORD_RECOVERY asynchronously. We catch it
    // here for environments that do not use the hash-based implicit flow.
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_FLAG, "1");
        setLocation("/wachtwoord-instellen");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
