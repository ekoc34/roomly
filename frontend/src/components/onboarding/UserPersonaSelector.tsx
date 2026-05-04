"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// TODO: Replace with backend integration when user profile table is ready
// For now, storing in localStorage as a temporary solution
const PERSONA_STORAGE_KEY = "roomly_user_persona";

type Persona = "student" | "professional" | "family";

const PERSONAS: Record<
  Persona,
  { label: string; icon: string; description: string; color: string }
> = {
  student: {
    label: "Student",
    icon: "🎓",
    description: "Looking for student housing or roommates",
    color: "rose",
  },
  professional: {
    label: "Professional / Expat",
    icon: "💼",
    description: "Working professional or expat looking for housing",
    color: "blue",
  },
  family: {
    label: "Family",
    icon: "👨‍👩‍👧‍👦",
    description: "Family looking for a home together",
    color: "emerald",
  },
};

export function UserPersonaSelector() {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const router = useRouter();

  // Load saved persona from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (saved && (saved === "student" || saved === "professional" || saved === "family")) {
      setSelectedPersona(saved as Persona);
    }
  }, []);

  const handleSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    // Save to localStorage for persistence
    localStorage.setItem(PERSONA_STORAGE_KEY, persona);
    
    // Redirect to dashboard after selection
    router.push("/dashboard");
  };

  const handleSkip = () => {
    // Allow user to skip persona selection
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center">
        <span className="text-4xl">👋</span>
        <h1 className="mt-4 text-3xl font-black text-stone-900 sm:text-4xl">
          Welkom bij Roomly
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-500">
          I am a...
        </p>
      </div>

      {/* Persona cards */}
      <div className="mt-8 grid gap-4">
        {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS[Persona]][]).map(
          ([key, persona]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className={`group flex flex-col items-start gap-4 rounded-3xl border-2 p-6 shadow-sm transition active:scale-[0.98] ${
                selectedPersona === key
                  ? "border-rose-300 bg-rose-50"
                  : "border-stone-200 bg-white hover:border-rose-300 hover:shadow-md"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition ${
                  persona.color === "rose"
                    ? "bg-rose-50 group-hover:bg-rose-100"
                    : persona.color === "blue"
                    ? "bg-blue-50 group-hover:bg-blue-100"
                    : "bg-emerald-50 group-hover:bg-emerald-100"
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
                <p className="mt-1 text-sm leading-relaxed text-stone-500">
                  {persona.description}
                </p>
              </div>
            </button>
          ),
        )}
      </div>

      {/* Skip option */}
      <p className="mt-8 text-center text-sm text-stone-400">
        Prefer to choose later?{" "}
        <button
          onClick={handleSkip}
          className="font-medium text-stone-600 hover:text-rose-600 hover:underline"
        >
          Skip for now
        </button>
      </p>
    </div>
  );
}

// Helper function to get the current user's persona
export function getUserPersona(): Persona | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(PERSONA_STORAGE_KEY);
  if (saved && (saved === "student" || saved === "professional" || saved === "family")) {
    return saved as Persona;
  }
  return null;
}
