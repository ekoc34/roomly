import { Link, useLocation } from "wouter";

export function MobileBottomNav() {
  const [path] = useLocation();
  const isHome = path === "/";
  const isKamers = path === "/kamers" || (path.startsWith("/kamers/") && path !== "/kamers/nieuw");
  const isFavs = path.startsWith("/favorieten");
  const isBerichten = path.startsWith("/berichten");
  const isDashboard = path === "/dashboard" || path === "/profiel";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-stone-200/80 bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        <Link href="/" data-testid="bottom-nav-home" className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${isHome ? "text-rose-600" : "text-stone-400 hover:text-stone-700"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isHome ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </Link>
        <Link href="/kamers" data-testid="bottom-nav-search" className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${isKamers ? "text-rose-600" : "text-stone-400 hover:text-stone-700"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isKamers ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Zoeken
        </Link>
        <Link href="/favorieten" data-testid="bottom-nav-favorites" className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${isFavs ? "text-rose-600" : "text-stone-400 hover:text-stone-700"}`}>
          <svg className="h-5 w-5" fill={isFavs ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Favorieten
        </Link>
        <Link href="/berichten" data-testid="bottom-nav-messages" className={`relative flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${isBerichten ? "text-rose-600" : "text-stone-400 hover:text-stone-700"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isBerichten ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Berichten
        </Link>
        <Link href="/dashboard" data-testid="bottom-nav-account" className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition ${isDashboard ? "text-rose-600" : "text-stone-400 hover:text-stone-700"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isDashboard ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Account
        </Link>
      </div>
    </nav>
  );
}
