import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

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

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (existing) return;

      const meta = user.user_metadata ?? {};
      const name =
        meta.full_name ?? meta.name ?? meta.given_name ?? user.email?.split("@")[0] ?? "";
      const email = user.email ?? "";
      const avatar_url = meta.avatar_url ?? meta.picture ?? null;

      await supabase.from("profiles").upsert({
        id: user.id,
        email,
        name,
        avatar_url,
        role: "student",
        phone_verified: false,
        email_auto_verified: true,
        student_verified: false,
      });

      sessionStorage.setItem(
        "oauthNewUser",
        JSON.stringify({ provider, name, avatar_url })
      );

      setLocation("/welkom");
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
