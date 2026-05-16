import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

/**
 * App-level component that intercepts Supabase hash-based auth tokens.
 *
 * Handles two token types in the URL hash:
 *   - type=signup   → email confirmation after registration
 *                     → sets "emailJustVerified" flag, redirects to /welkom
 *   - type=magiclink → magic link sign-in
 *                     → sets "emailJustVerified" flag, redirects to /welkom
 *
 * The hash is cleared from the URL synchronously before any async work so
 * the tokens are never visible after the first render cycle.
 */
export function EmailVerificationHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");

    // Only handle email-confirmation types — leave other flows alone.
    if (type !== "signup" && type !== "magiclink") return;

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") ?? "";

    // Strip hash from URL immediately — before any async work.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (!accessToken || !supabase) {
      toast.error("De verificatielink is verlopen. Vraag een nieuwe aan.");
      return;
    }

    const handle = async () => {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user) {
        toast.error("De verificatielink is verlopen. Vraag een nieuwe aan.");
        return;
      }

      // Signal to /welkom that it should show the verification success toast.
      sessionStorage.setItem("emailJustVerified", "1");
      setLocation("/welkom");
    };

    handle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
