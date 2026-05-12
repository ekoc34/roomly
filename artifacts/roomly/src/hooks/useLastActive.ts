import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const THROTTLE_MS = 5 * 60 * 1000;

// Module-level timestamp so all callers (hook + imperative) share the same throttle window.
let lastUpdatedAt = 0;

export async function pingLastActive(userId: string): Promise<void> {
  if (!supabase) return;
  const now = Date.now();
  if (now - lastUpdatedAt < THROTTLE_MS) return;
  lastUpdatedAt = now;
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);
}

export function useLastActive() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    pingLastActive(user.id);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") pingLastActive(user.id);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", () => pingLastActive(user.id));

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", () => pingLastActive(user.id));
    };
  }, [user]);
}
