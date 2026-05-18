import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { IdentityVerification } from "@/types/database";

export type IdentityVerificationState = {
  verification: IdentityVerification | null;
  loading: boolean;
  refetch: () => void;
};

export function useIdentityVerification(): IdentityVerificationState {
  const { user } = useAuth();
  const [verification, setVerification] = useState<IdentityVerification | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("identity_verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setVerification((data as IdentityVerification | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { verification, loading, refetch: fetch };
}
