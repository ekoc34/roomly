"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { CitySelector } from "@/components/search/CitySelector";
import { getUserPersona } from "@/components/onboarding/UserPersonaSelector";

type HeaderClientProps = {
  userEmail: string | null;
};

const PERSONA_LABELS: Record<string, { label: string; icon: string }> = {
  student: { label: "Student", icon: "🎓" },
  professional: { label: "Professional", icon: "💼" },
  family: { label: "Family", icon: "👨‍👩‍👧‍👦" },
};

export function HeaderClient({ userEmail }: HeaderClientProps) {
  const [persona, setPersona] = useState<string | null>(null);

  // Load persona from localStorage on mount
  useEffect(() => {
    setPersona(getUserPersona());
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-rose-600"
        >
          Roomly
        </Link>
        
        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
          <Link href="/kamers" className="transition hover:text-rose-600">
            Kamers
          </Link>
          
          {/* City Selector - for multi-city expansion */}
          <CitySelector />
          
          {userEmail ? (
            <>
              <Link href="/dashboard" className="transition hover:text-rose-600">
                Dashboard
              </Link>
              
              {/* Persona Badge - shows user's selected persona */}
              {persona && PERSONA_LABELS[persona] && (
                <span className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                  <span>{PERSONA_LABELS[persona].icon}</span>
                  {PERSONA_LABELS[persona].label}
                </span>
              )}
              
              <Link
                href="/kamers/nieuw"
                className="rounded-full border border-stone-200 px-4 py-1.5 text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Kamer plaatsen
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm font-medium text-stone-500 transition hover:text-rose-600"
                >
                  Uitloggen
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/inloggen" className="transition hover:text-rose-600">
                Inloggen
              </Link>
              <Link
                href="/registreren"
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
              >
                Gratis aanmelden
              </Link>
            </>
          )}
        </nav>
        
        <div className="flex items-center gap-2 md:hidden">
          {/* Mobile City Selector */}
          <CitySelector />
          
          {/* Mobile Persona Badge */}
          {userEmail && persona && PERSONA_LABELS[persona] && (
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600">
              {PERSONA_LABELS[persona].icon}
            </span>
          )}
          
          {userEmail ? (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Uitloggen
              </button>
            </form>
          ) : (
            <Link
              href="/registreren"
              className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              Gratis aanmelden
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
