import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

export function PasswordRecoveryHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setLocation("/wachtwoord-instellen");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
