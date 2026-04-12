"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileBottomNav() {
  const path = usePathname();
  const isHome = path === "/";
  const isKamers = path === "/kamers" || (path.startsWith("/kamers/") && path !== "/kamers/nieuw");
  const isNieuw = path === "/kamers/nieuw";
  const isDashboard = path === "/dashboard";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-stone-200/80 bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {/* Home */}
        <Link
          href="/"
          className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
            isHome ? "text-rose-600" : "text-stone-400 hover:text-stone-700"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isHome ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>

        {/* Bekijk kamers — prominent rose CTA */}
        <Link
          href="/kamers"
          className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95 ${
            isKamers
              ? "bg-rose-600 text-white"
              : "bg-rose-500 text-white hover:bg-rose-600"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Bekijk kamers
        </Link>

        {/* Adverteren */}
        <Link
          href="/kamers/nieuw"
          className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
            isNieuw ? "text-rose-600" : "text-stone-400 hover:text-stone-700"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isNieuw ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Adverteren
        </Link>

        {/* Account */}
        <Link
          href="/dashboard"
          className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
            isDashboard ? "text-rose-600" : "text-stone-400 hover:text-stone-700"
          }`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isDashboard ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Account
        </Link>
      </div>
    </nav>
  );
}
