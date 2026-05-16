import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export function EmailVerifiedPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") ?? "";

    if (!accessToken || !supabase) {
      setStatus("error");
      return;
    }

    window.history.replaceState(null, "", window.location.pathname);

    const handle = async () => {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user) {
        setStatus("error");
        return;
      }

      setStatus("success");
      toast.success("Je e-mailadres is succesvol geverifieerd!");
      sessionStorage.setItem("emailJustVerified", "1");
      setTimeout(() => setLocation("/profiel"), 3000);
    };

    handle();
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
          <p className="text-sm text-stone-500">Verificatie bezig…</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-stone-900">E-mailadres geverifieerd!</h1>
          <p className="text-sm text-stone-500">Je wordt automatisch doorgestuurd naar je profiel…</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
            <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-stone-900">Verificatielink verlopen</h1>
          <p className="text-sm text-stone-500">De verificatielink is verlopen. Vraag een nieuwe aan via je profiel.</p>
          <a href="/profiel" className="mt-2 inline-block rounded-2xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 active:scale-[0.98]">
            Naar profiel
          </a>
        </div>
      )}
    </div>
  );
}
