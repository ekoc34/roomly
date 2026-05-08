import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const THROTTLE_MS = 5 * 60 * 1000;

export function useLastActive() {
  const { user } = useAuth();
  const lastUpdatedRef = useRef<number>(0);

  useEffect(() => {
    if (!user || !supabase) return;

    async function ping() {
      const now = Date.now();
      if (now - lastUpdatedRef.current < THROTTLE_MS) return;
      lastUpdatedRef.current = now;
      await supabase!
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user!.id);
    }

    ping();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", ping);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", ping);
    };
  }, [user]);
}
