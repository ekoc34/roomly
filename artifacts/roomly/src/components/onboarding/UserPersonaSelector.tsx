import { useState, useTransition } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserType } from "@/types/database";

type Step1Choice = "huurder" | "landlord";

const STEP2_OPTIONS: {
  key: UserType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "student",
    label: "Student",
    description: "Ik studeer en zoek een kamer of studio",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z" />
      </svg>
    ),
  },
  {
    key: "professional",
    label: "Professional / Expat",
    description: "Ik werk en zoek een appartement of kamer",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "alleenstaande",
    label: "Alleenstaande",
    description: "Ik zoek een woning voor mezelf",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: "family",
    label: "Familie",
    description: "Wij zoeken een woning als gezin",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function UserPersonaSelector() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Choice, setStep1Choice] = useState<Step1Choice | null>(null);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const saveAndRedirect = (userType: UserType) => {
    startTransition(async () => {
      if (supabase && user) {
        await supabase.from("profiles").update({ user_type: userType }).eq("id", user.id);
      }
      navigate("/dashboard");
    });
  };

  const handleStep1 = (choice: Step1Choice) => {
    if (choice === "landlord") {
      saveAndRedirect("landlord");
      return;
    }
    setStep1Choice(choice);
    setAnimating(true);
    setTimeout(() => {
      setStep(2);
      setAnimating(false);
    }, 220);
  };

  const handleStep2 = (userType: UserType) => {
    saveAndRedirect(userType);
  };

  const goBack = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep(1);
      setStep1Choice(null);
      setAnimating(false);
    }, 220);
  };

  return (
    <div className="w-full max-w-lg" data-testid="persona-selector">
      <div
        className="transition-opacity duration-200"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {step === 1 && (
          <>
            <div className="text-center">
              <span className="text-4xl">👋</span>
              <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">Welkom bij Welkthuis</h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-rose-500">Stap 1 van 2</p>
              <p className="mt-2 text-base leading-relaxed text-stone-500">Wat is je rol? Zo personaliseren we je ervaring.</p>
            </div>

            <div className="mt-8 grid gap-4">
              <button
                onClick={() => handleStep1("huurder")}
                disabled={isPending}
                data-testid="persona-huurder"
                className="group flex items-center gap-5 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition group-hover:bg-rose-100">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-stone-900 group-hover:text-rose-600">Huurder</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-500">Ik zoek een woning om te huren</p>
                </div>
                <svg className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => handleStep1("landlord")}
                disabled={isPending}
                data-testid="persona-landlord"
                className="group flex items-center gap-5 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-amber-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 transition group-hover:bg-amber-100">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-stone-900 group-hover:text-amber-600">Verhuurder</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-500">Ik wil een kamer of woning verhuren</p>
                </div>
                <svg className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-stone-400">
              Liever later kiezen?{" "}
              <button
                onClick={() => navigate("/dashboard")}
                className="font-medium text-stone-600 hover:text-rose-600 hover:underline"
                data-testid="persona-skip"
              >
                Sla over
              </button>
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center">
              <button
                onClick={goBack}
                className="mb-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Terug
              </button>
              <p className="text-sm font-semibold uppercase tracking-widest text-rose-500">Stap 2 van 2</p>
              <h2 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">Hoe wil je wonen?</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-500">Kies wat het beste bij jou past.</p>
            </div>

            <div className="mt-8 grid gap-3">
              {STEP2_OPTIONS.map(({ key, label, description, icon }) => (
                <button
                  key={key}
                  onClick={() => handleStep2(key)}
                  disabled={isPending}
                  data-testid={`persona-${key}`}
                  className="group flex items-center gap-4 rounded-3xl border-2 border-stone-200 bg-white p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition group-hover:bg-rose-100">
                    {icon}
                  </div>
                  <div className="text-left">
                    <p className="text-base font-bold text-stone-900 group-hover:text-rose-600">{label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
