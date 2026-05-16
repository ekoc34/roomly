import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { UserPersonaSelector } from "@/components/onboarding/UserPersonaSelector";

type OAuthInfo = { provider: "google" | "facebook"; name: string; avatar_url: string | null };

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
};

/**
 * Onboarding / welcome page — shown to new users who haven't picked a role yet.
 *
 * Guard behaviour:
 *   - Not logged in            → redirect to /registreren
 *   - Logged in, user_type set → redirect to /dashboard (already onboarded)
 *   - Logged in, user_type null → show UserPersonaSelector (happy path)
 *
 * Toast behaviour:
 *   - If "emailJustVerified" is set in sessionStorage on mount,
 *     show a success toast and clear the flag immediately.
 */
export function WelcomePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [oauthInfo, setOauthInfo] = useState<OAuthInfo | null>(null);
  const [checking, setChecking] = useState(true);

  // ── One-time flags set by EmailVerificationHandler / OAuthProfileHandler ──
  useEffect(() => {
    // Email verification success toast
    if (sessionStorage.getItem("emailJustVerified") === "1") {
      sessionStorage.removeItem("emailJustVerified");
      // Slight delay so the page has painted before the toast appears.
      setTimeout(() => {
        toast.success("Je e-mailadres is succesvol geverifieerd!");
      }, 200);
    }

    // OAuth new-user banner
    const raw = sessionStorage.getItem("oauthNewUser");
    if (raw) {
      try {
        setOauthInfo(JSON.parse(raw) as OAuthInfo);
      } catch {
        // ignore malformed entry
      }
      sessionStorage.removeItem("oauthNewUser");
    }
  }, []);

  // ── Guard: redirect non-users and already-onboarded users ────────────────
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/registreren");
      return;
    }

    if (!supabase) {
      setChecking(false);
      return;
    }

    supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.user_type) {
          navigate("/dashboard");
        } else {
          setChecking(false);
        }
      });
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4 py-16">
      {oauthInfo && (
        <div className="mb-8 flex w-full max-w-lg flex-col items-center gap-3 rounded-3xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            {oauthInfo.avatar_url ? (
              <img
                src={oauthInfo.avatar_url}
                alt={oauthInfo.name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-rose-100"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl font-bold text-rose-600">
                {oauthInfo.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-stone-900">
                Ingelogd via {PROVIDER_LABEL[oauthInfo.provider] ?? oauthInfo.provider}
              </p>
              <p className="text-xs text-stone-500">{oauthInfo.name}</p>
            </div>
          </div>
          <p className="text-center text-sm text-stone-500">
            Je account is aangemaakt. Kies hieronder hoe je Welkthuis wil gebruiken.
          </p>
        </div>
      )}
      <UserPersonaSelector />
    </div>
  );
}
