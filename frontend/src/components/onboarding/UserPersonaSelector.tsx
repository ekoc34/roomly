"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserType } from "@/app/actions/profile";
import type { UserType } from "@/types/database";

type Persona = "student" | "professional" | "family" | "landlord";

const PERSONAS: Record<
  Persona,
  { label: string; icon: string; description: string; color: string }
> = {
  student: {
    label: "Student",
    icon: "🎓",
    description: "Ik zoek studentenhuisvesting of een mede-huurder",
    color: "rose",
  },
  professional: {
    label: "Professional / Expat",
    icon: "💼",
    description: "Ik werk en zoek een appartement of kamer",
    color: "blue",
  },
  family: {
    label: "Familie",
    icon: "🏡",
    description: "Wij zoeken een woning samen als gezin",
    color: "emerald",
  },
  landlord: {
    label: "Verhuurder",
    icon: "🔑",
    description: "Ik wil een kamer of woning verhuren",
    color: "amber",
  },
};

export function UserPersonaSelector() {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    startTransition(async () => {
      await setUserType(persona as UserType);
      router.push("/dashboard");
    });
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-lg" data-testid="persona-selector">
      <div className="text-center">
        <span className="text-4xl">👋</span>
        <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">
          Welkom bij Roomly
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-500">
          Kies wat het beste bij je past — zo personaliseren we je ervaring.
        </p>
      </div>

      <div className="mt-8 grid gap-4">
        {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS[Persona]][]).map(
          ([key, persona]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              disabled={isPending}
              data-testid={`persona-${key}`}
              className={`group flex items-center gap-4 rounded-3xl border-2 p-5 shadow-sm transition active:scale-[0.98] ${
                selectedPersona === key
                  ? "border-rose-300 bg-rose-50"
                  : "border-stone-200 bg-white hover:border-rose-300 hover:shadow-md"
              } disabled:opacity-50`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                  persona.color === "rose"
                    ? "bg-rose-50 group-hover:bg-rose-100"
                    : persona.color === "blue"
                    ? "bg-blue-50 group-hover:bg-blue-100"
                    : persona.color === "emerald"
                    ? "bg-emerald-50 group-hover:bg-emerald-100"
                    : "bg-amber-50 group-hover:bg-amber-100"
                }`}
              >
                <span className="text-2xl">{persona.icon}</span>
              </div>
              <div className="text-left">
                <p
                  className={`text-base font-bold ${
                    selectedPersona === key
                      ? "text-rose-700"
                      : "text-stone-900 group-hover:text-rose-600"
                  }`}
                >
                  {persona.label}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-stone-500">
                  {persona.description}
                </p>
              </div>
            </button>
          ),
        )}
      </div>

      <p className="mt-8 text-center text-sm text-stone-400">
        Liever later kiezen?{" "}
        <button
          onClick={handleSkip}
          className="font-medium text-stone-600 hover:text-rose-600 hover:underline"
          data-testid="persona-skip"
        >
          Sla over
        </button>
      </p>
    </div>
  );
}
