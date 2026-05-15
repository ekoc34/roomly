import { useEffect, useState, useTransition } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserType } from "@/types/database";

type Step1Choice = "woningzoekende" | "verhuurder" | "huisgenoot_zoeker";

type Step2Option = { key: UserType; label: string; description: string; icon: React.ReactNode };

const STEP2_ALL: Step2Option[] = [
  {
    key: "student",
    label: "Student",
    description: "Ik studeer en zoek een kamer of studio",
    icon: <span className="text-2xl leading-none">🎓</span>,
  },
  {
    key: "professional",
    label: "Professional / Expat",
    description: "Ik werk en zoek een appartement of kamer",
    icon: <span className="text-2xl leading-none">💼</span>,
  },
  {
    key: "alleenstaande",
    label: "Alleenstaande",
    description: "Ik zoek een woning voor mezelf",
    icon: <span className="text-2xl leading-none">🧍</span>,
  },
  {
    key: "family",
    label: "Familie · Stel",
    description: "We zoeken naar een huis",
    icon: <span className="text-2xl leading-none">🏡</span>,
  },
];

const STEP2_HUISGENOOT: Step2Option[] = STEP2_ALL.filter((o) => o.key !== "family");

export function UserPersonaSelector() {
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Choice, setStep1Choice] = useState<Step1Choice | null>(null);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAdmin, setIsAdmin] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role === "admin") setIsAdmin(true);
      });
  }, [user]);

  const saveAndRedirect = (userType: UserType) => {
    startTransition(async () => {
      if (supabase && user) {
        await supabase.from("profiles").update({ user_type: userType }).eq("id", user.id);
      }
      navigate("/dashboard");
    });
  };

  const goToStep2 = (choice: Step1Choice) => {
    setStep1Choice(choice);
    setAnimating(true);
    setTimeout(() => { setStep(2); setAnimating(false); }, 220);
  };

  const handleStep1 = (choice: Step1Choice) => {
    if (choice === "verhuurder") { saveAndRedirect("verhuurder"); return; }
    goToStep2(choice);
  };

  const goBack = () => {
    setAnimating(true);
    setTimeout(() => { setStep(1); setAnimating(false); }, 220);
  };

  const step2Options = step1Choice === "huisgenoot_zoeker" ? STEP2_HUISGENOOT : STEP2_ALL;

  return (
    <div className="w-full max-w-lg" data-testid="persona-selector">
      <div className="transition-opacity duration-200" style={{ opacity: animating ? 0 : 1 }}>

        {step === 1 && (
          <>
            <div className="text-center">
              <span className="text-4xl">👋</span>
              <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">Welkom bij Welkthuis</h1>
              <p className="mt-2 text-base leading-relaxed text-stone-500">Wat is je rol? Zo personaliseren we je ervaring.</p>
            </div>

            <div className="mt-8 grid gap-4">
              {/* Verhuurder */}
              <button
                onClick={() => handleStep1("verhuurder")}
                disabled={isPending}
                data-testid="persona-verhuurder"
                className="group flex items-center gap-5 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-amber-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 transition group-hover:bg-amber-100">
                  <span className="text-3xl leading-none">🏢</span>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-stone-900 group-hover:text-amber-600">Verhuurder</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-500">Ik verhuur kamers of woningen</p>
                  <p className="mt-1 text-xs text-stone-400">Plaats advertenties voor kamerverhuur en kort verblijf.</p>
                </div>
                <svg className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Woningzoekende */}
              <button
                onClick={() => handleStep1("woningzoekende")}
                disabled={isPending}
                data-testid="persona-woningzoekende"
                className="group flex items-center gap-5 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition group-hover:bg-rose-100">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-stone-900 group-hover:text-rose-600">Woningzoekende</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-500">Ik zoek een woning voor mezelf</p>
                  <p className="mt-1 text-xs text-stone-400">Vind kamers, appartementen en meer.</p>
                </div>
                <svg className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Huisgenoot zoeker */}
              <button
                onClick={() => handleStep1("huisgenoot_zoeker")}
                disabled={isPending}
                data-testid="persona-huisgenoot_zoeker"
                className="group flex items-center gap-5 rounded-3xl border-2 border-stone-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 transition group-hover:bg-blue-100">
                  <span className="text-3xl leading-none">🤝</span>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-stone-900 group-hover:text-blue-600">Huisgenoot zoeker</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-stone-500">Op zoek naar een huisgenoot</p>
                  <p className="mt-1 text-xs text-stone-400">Ik heb een woning en zoek iemand om mee te delen.</p>
                </div>
                <svg className="ml-auto h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {isAdmin && (
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
            )}
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
              <h2 className="mt-2 text-2xl font-black text-stone-900 sm:text-3xl">Kies je situatie</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-500">Kies wat het beste bij jou past.</p>
            </div>

            <div className="mt-8 grid gap-3">
              {step2Options.map(({ key, label, description, icon }) => (
                <button
                  key={key}
                  onClick={() => saveAndRedirect(key)}
                  disabled={isPending}
                  data-testid={`persona-${key}`}
                  className="group flex items-center gap-4 rounded-3xl border-2 border-stone-200 bg-white p-5 shadow-sm transition hover:border-rose-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 transition group-hover:bg-rose-100">
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
