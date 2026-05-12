import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

export function Footer() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user || !supabase) { setProfile(null); return; }
    supabase.from("profiles").select("user_type").eq("id", user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null);
    });
  }, [user]);

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate("/inloggen");
  };

  const canPost = profile?.user_type === "verhuurder" || profile?.user_type === "huisgenoot_zoeker";

  return (
    <footer className="mt-auto border-t border-stone-200/80 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Welkthuis logo" className="h-10 w-10" />
              <p className="text-xl tracking-tight">
                <span className="font-semibold text-rose-500">Welkthuis<span className="font-normal text-rose-500">.nl</span></span>
              </p>
            </div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
              Woningen vinden in Nederland — eerlijk, duidelijk en snel. Voor studenten, professionals, expats, families en alleenstaanden.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Geverifieerd
              </span>
              <span className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Veilig
              </span>
            </div>
          </div>

          {user ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Platform</p>
                <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
                  <Link href="/kamers" className="hover:text-rose-600">Zoek woningen</Link>
                  {canPost && (
                    <Link href="/kamers/nieuw" className="hover:text-rose-600">Advertentie plaatsen</Link>
                  )}
                  <Link href="/contact" className="hover:text-rose-600">Contact</Link>
                </nav>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Persoonlijk</p>
                <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
                  <Link href="/favorieten" className="hover:text-rose-600">Favorieten</Link>
                  <Link href="/berichten" className="hover:text-rose-600">Berichten</Link>
                </nav>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Account</p>
                <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
                  <Link href="/dashboard" className="hover:text-rose-600">Dashboard</Link>
                  <Link href="/profiel" className="hover:text-rose-600">Profiel</Link>
                  <button onClick={handleSignOut} className="text-left hover:text-rose-600">
                    Uitloggen
                  </button>
                </nav>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Platform</p>
                <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
                  <Link href="/kamers" className="hover:text-rose-600">Zoek woningen</Link>
                  <Link href="/contact" className="hover:text-rose-600">Contact</Link>
                </nav>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Account</p>
                <nav className="mt-3 flex flex-col gap-2.5 text-sm text-stone-600">
                  <Link href="/inloggen" className="hover:text-rose-600">Inloggen</Link>
                  <Link href="/registreren" className="hover:text-rose-600">Account aanmaken</Link>
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-stone-100 bg-stone-50/80 py-4 text-center text-xs text-stone-400">
        © 2026 Welkthuis.nl
      </div>
    </footer>
  );
}
