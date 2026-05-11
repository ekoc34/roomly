import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Props = {
  user: User;
};

export function EmailVerificationGate({ user }: Props) {
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(t); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!supabase || !user.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    setResending(false);
    if (error) {
      toast.error("Versturen mislukt. Probeer het later opnieuw.");
    } else {
      toast.success("Verificatiemail opnieuw verzonden. Check je inbox!");
      setCooldown(60);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-8 shadow-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
          <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-stone-900">Verifieer je e-mailadres</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-500">
          We hebben een verificatielink gestuurd naar{" "}
          <span className="font-semibold text-stone-700">{user.email}</span>.
          Klik op de link in de e-mail om verder te gaan.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          Geen e-mail ontvangen? Check ook je spammap.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
          >
            {resending
              ? "Versturen…"
              : cooldown > 0
              ? `Opnieuw versturen (${cooldown}s)`
              : "Verificatie opnieuw sturen"}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 active:scale-[0.98]"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
}
