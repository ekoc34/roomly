import { useEffect, useRef, useState, useTransition } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const ROLES = [
  {
    value: "verhuurder",
    icon: "🏢",
    label: "Verhuurder",
    description: "Ik verhuur een kamer of woning",
  },
  {
    value: "student",
    icon: "🎓",
    label: "Student",
    description: "Ik studeer en zoek een kamer of studio",
  },
  {
    value: "professional",
    icon: "💼",
    label: "Professional / Expat",
    description: "Ik werk en zoek een appartement of kamer",
  },
  {
    value: "alleenstaande",
    icon: "🧍",
    label: "Alleenstaande",
    description: "Ik zoek een woning voor mezelf",
  },
  {
    value: "family",
    icon: "🏡",
    label: "Familie · Stel",
    description: "We zoeken een huis",
  },
  {
    value: "huisgenoot_zoeker",
    icon: "🤝",
    label: "Huisgenoot zoeker",
    description: "Ik zoek een huisgenoot of gedeelde woning",
  },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

export function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<RoleValue | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Read and immediately clear the one-time "just_verified" flag set by
  // AuthCallbackPage. This flag is the ONLY legitimate entry point into
  // onboarding — direct URL access or normal login must never reach here.
  const justVerified = useRef<boolean>(
    sessionStorage.getItem("just_verified") === "1"
  );
  useEffect(() => {
    sessionStorage.removeItem("just_verified");
  }, []);

  // ── Auth guard ───────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.email_confirmed_at) {
      navigate("/inloggen");
      return;
    }
  }, [user, authLoading, navigate]);

  // ── Onboarding access guard ──────────────────────────────────
  // Gate 1: must have arrived via /auth/callback (just_verified flag).
  // Gate 2: DB check — if already completed, always skip to dashboard.
  useEffect(() => {
    if (authLoading || !user || !supabase) return;

    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.onboarding_completed) {
          // Already done — redirect regardless of how they got here.
          navigate("/dashboard");
          return;
        }
        // Not completed — only allow access if coming from verification.
        if (!justVerified.current) {
          navigate("/dashboard");
        }
      });
  }, [user, authLoading, navigate]);

  const handleSubmit = () => {
    if (!selected) {
      setError("Kies een profiel om verder te gaan.");
      return;
    }
    if (!supabase || !user) return;
    setError(null);
    startTransition(async () => {
      const role = selected === "verhuurder" ? "landlord" : "student";
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          user_type: selected,
          role,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (updateErr) {
        setError("Opslaan mislukt. Probeer het opnieuw.");
        return;
      }
      navigate("/dashboard");
    });
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-300 border-t-rose-500" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Welkom bij Roomly — Vertel ons wie je bent</title>
      </Helmet>

      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-3xl font-black text-rose-600">Roomly</p>
          <h1 className="mt-3 text-2xl font-bold text-stone-900">
            Welkom! Vertel ons wie je bent.
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Kies het profiel dat het beste bij jou past. Je kunt dit later altijd aanpassen.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {ROLES.map((r) => {
            const active = selected === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setSelected(r.value)}
                className={`flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all active:scale-[0.98] ${
                  active
                    ? "border-rose-400 bg-rose-50 shadow-md"
                    : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
                }`}
              >
                <span className="text-3xl leading-none">{r.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${active ? "text-rose-700" : "text-stone-800"}`}>
                    {r.label}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">{r.description}</p>
                </div>
                {active && (
                  <div className="ml-auto shrink-0">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !selected}
          className="mt-7 w-full rounded-2xl bg-rose-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-rose-600 disabled:opacity-50 active:scale-[0.98]"
        >
          {isPending ? "Bezig…" : "Doorgaan naar dashboard →"}
        </button>

        <p className="mt-4 text-center text-xs text-stone-400">
          Je kunt je profiel later altijd aanpassen via{" "}
          <a href="/profiel" className="underline underline-offset-2 hover:text-stone-600">
            instellingen
          </a>
          .
        </p>
      </div>
    </>
  );
}
