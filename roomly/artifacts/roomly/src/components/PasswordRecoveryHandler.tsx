import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

const RECOVERY_FLAG = "roomly_recovery_pending";

export function PasswordRecoveryHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // ── Hash-based detection (runs before Supabase clears the hash) ──────────
    const hash = window.location.hash;
    if (hash.includes("type=recovery") && hash.includes("access_token=")) {
      sessionStorage.setItem(RECOVERY_FLAG, "1");
      setLocation("/wachtwoord-instellen");
      return;
    }

    // ── Event-based detection (fallback for PKCE / server-side code exchange) ─
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
