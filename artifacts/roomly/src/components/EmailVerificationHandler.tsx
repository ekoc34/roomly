import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function EmailVerificationHandler() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    if (type !== "magiclink") return;

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") ?? "";
    if (!accessToken || !supabase) {
      toast.error("De verificatielink is verlopen. Vraag een nieuwe aan.");
      return;
    }

    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const handle = async () => {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user) {
        toast.error("De verificatielink is verlopen. Vraag een nieuwe aan.");
        return;
      }

      toast.success("Je e-mailadres is succesvol geverifieerd!");
      sessionStorage.setItem("emailJustVerified", "1");
      setTimeout(() => setLocation("/profiel"), 1500);
    };

    handle();
  }, []);

  return null;
}
