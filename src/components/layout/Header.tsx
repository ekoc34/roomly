import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  let userEmail: string | null = null;
  if (getSupabaseConfig()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userEmail = user?.email ?? null;
    } catch {
      userEmail = null;
    }
  }

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
          {userEmail ? (
            <>
              <Link href="/dashboard" className="transition hover:text-rose-600">
                Dashboard
              </Link>
              <Link
                href="/kamers/nieuw"
                className="rounded-full border border-stone-200 px-4 py-1.5 text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Adverteren
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
                Account aanmaken
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
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
              Account aanmaken
            </Link>
          )}
        </div>
      </div>
      <div className="border-t border-stone-100 bg-stone-50/90 px-4 py-2.5 md:hidden">
        <nav className="flex items-center justify-around text-xs font-medium text-stone-600">
          <Link href="/" className="flex flex-col items-center gap-0.5 hover:text-rose-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </Link>
          <Link href="/kamers" className="flex flex-col items-center gap-0.5 hover:text-rose-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Kamers
          </Link>
          <Link href="/kamers/nieuw" className="flex flex-col items-center gap-0.5 text-rose-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adverteren
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 hover:text-rose-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
