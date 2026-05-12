import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

/**
 * Mounted globally in App.tsx. Listens for every SIGNED_IN event from a
 * Google or Facebook OAuth provider and decides what to do next:
 *
 *   - New user  (user_type is NULL)  → upsert display name + avatar from OAuth
 *                                      metadata, store info for WelcomePage,
 *                                      then navigate to /welkom.
 *   - Returning user (user_type set) → do nothing; let the redirectTo URL
 *                                      supplied at sign-in time take effect.
 *
 * WHY we check user_type and not profile existence:
 *   The handle_new_user Postgres trigger auto-creates a minimal profile row
 *   (id, email only) the instant a new auth.users record is created. So the
 *   profile row always exists — we cannot use "does it exist" to detect new
 *   users. user_type is NULL until the user completes /welkom onboarding,
 *   which is the correct signal.
 */
export function OAuthProfileHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      const user = session.user;
      const provider = user.app_metadata?.provider;

      if (provider !== "google" && provider !== "facebook") return;

      // Fetch current profile — only need user_type to detect new vs returning.
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

      const isNewUser = !profile?.user_type;

      if (isNewUser) {
        // Enrich the minimal profile row that the DB trigger created with the
        // OAuth display name and avatar. We only do this once — returning users
        // may have edited their profile manually, so we leave them alone.
        const meta = user.user_metadata ?? {};
        const name =
          meta.full_name ?? meta.name ?? meta.given_name ?? user.email?.split("@")[0] ?? "";
        const email = user.email ?? "";
        const avatar_url = meta.avatar_url ?? meta.picture ?? null;

        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email,
            name,
            avatar_url,
            email_auto_verified: true,
          },
          { onConflict: "id" }
        );

        // Pass provider info to WelcomePage so it can show a personalised banner.
        sessionStorage.setItem(
          "oauthNewUser",
          JSON.stringify({ provider, name, avatar_url })
        );

        setLocation("/welkom");
      }
      // Returning users: do nothing — they land wherever redirectTo pointed.
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
