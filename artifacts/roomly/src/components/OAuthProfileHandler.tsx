import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

/**
 * Mounted globally in App.tsx. Listens for auth state changes from Google or
 * Facebook OAuth and decides what to do next:
 *
 *   - New user  (user_type is NULL)  → upsert display name + avatar from OAuth
 *                                      metadata, store info for WelcomePage,
 *                                      then navigate to /welkom.
 *   - Returning user (user_type set) → do nothing; let the redirectTo URL
 *                                      supplied at sign-in time take effect.
 *
 * WHY we handle both SIGNED_IN and INITIAL_SESSION:
 *   After an OAuth redirect the browser performs a full page load at the
 *   redirectTo URL. On that fresh load Supabase fires INITIAL_SESSION (not
 *   SIGNED_IN) when it detects the access_token in the URL hash. If we only
 *   listen for SIGNED_IN we miss Google OAuth entirely on the first load.
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
      // Handle both the initial page-load session (INITIAL_SESSION — fired when
      // the access_token hash is detected on a fresh load after OAuth redirect)
      // and normal sign-ins (SIGNED_IN — fired on subsequent tab-focus refreshes
      // or when signing in without a page reload).
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      if (!session?.user) return;

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
        // Resolve the display name. Supabase surfaces provider data in two
        // places; we check both to maximise compatibility across providers and
        // account configurations.
        //
        //   user.user_metadata  = raw_user_meta_data — contains fields the
        //                         provider returned (varies by provider/scope)
        //   user.identities[0].identity_data — raw provider payload; usually
        //                         more complete, especially for Facebook.
        const meta = user.user_metadata ?? {};
        const identityData = user.identities?.[0]?.identity_data ?? {};

        const name =
          meta.full_name ??
          meta.name ??
          identityData.full_name ??
          identityData.name ??
          meta.given_name ??
          identityData.given_name ??
          user.email?.split("@")[0] ??
          "";

        const avatar_url =
          meta.avatar_url ??
          meta.picture ??
          identityData.avatar_url ??
          identityData.picture ??
          null;

        const email = user.email ?? "";

        // Enrich the minimal profile row the DB trigger created with the real
        // OAuth display name and avatar. We do this only once for new users —
        // returning users may have manually edited their profile.
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
