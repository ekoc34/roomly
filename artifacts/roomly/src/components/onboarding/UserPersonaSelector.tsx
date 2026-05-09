import { useState, useTransition } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserType } from "@/types/database";

type Persona = UserType;

const PERSONAS: Record<Persona, { label: string; icon: string; description: string; color: string }> = {
  student: { label: "Student", icon: "🎓", description: "Ik studeer en zoek een kamer of mede-huurder", color: "rose" },
  tenant: { label: "Huurder", icon: "🏠", description: "Ik zoek een woning om te huren", color: "rose" },
  professional: { label: "Professional / Expat", icon: "💼", description: "Ik werk en zoek een appartement of kamer", color: "blue" },
  family: { label: "Familie", icon: "🏡", description: "Wij zoeken een woning samen als gezin", color: "emerald" },
  landlord: { label: "Verhuurder", icon: "🔑", description: "Ik wil een kamer of woning verhuren", color: "amber" },
};

const PERSONA_COLOR_CLASSES: Record<string, string> = {
  rose: "bg-rose-50 group-hover:bg-rose-100",
  blue: "bg-blue-50 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 group-hover:bg-emerald-100",
  amber: "bg-amber-50 group-hover:bg-amber-100",
};

export function UserPersonaSelector() {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isPending, startTransition] = useTransition();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const handleSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    startTransition(async () => {
      if (supabase && user) {
        await supabase.from("profiles").update({ user_type: persona }).eq("id", user.id);
      }
      navigate("/dashboard");
    });
  };

  return (
    <div className="w-full max-w-lg" data-testid="persona-selector">
      <div className="text-center">
        <span className="text-4xl">👋</span>
        <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">Welkom bij Welkthuis</h1>
        <p className="mt-3 text-base leading-relaxed text-stone-500">Kies wat het beste bij je past — zo personaliseren we je ervaring.</p>
      </div>
      <div className="mt-8 grid gap-4">
        {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS[Persona]][]).map(([key, persona]) => (
          <button
            key={key}
            onClick={() => handleSelect(key)}
            disabled={isPending}
            data-testid={`persona-${key}`}
            className={`group flex items-center gap-4 rounded-3xl border-2 p-5 shadow-sm transition active:scale-[0.98] ${selectedPersona === key ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-white hover:border-rose-300 hover:shadow-md"} disabled:opacity-50`}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${PERSONA_COLOR_CLASSES[persona.color] ?? PERSONA_COLOR_CLASSES.rose}`}>
              <span className="text-2xl">{persona.icon}</span>
            </div>
            <div className="text-left">
              <p className={`text-base font-bold ${selectedPersona === key ? "text-rose-700" : "text-stone-900 group-hover:text-rose-600"}`}>{persona.label}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{persona.description}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-stone-400">
        Liever later kiezen?{" "}
        <button onClick={() => navigate("/dashboard")} className="font-medium text-stone-600 hover:text-rose-600 hover:underline" data-testid="persona-skip">Sla over</button>
      </p>
    </div>
  );
}
