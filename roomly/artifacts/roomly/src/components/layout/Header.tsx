import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { CitySelector } from "@/components/search/CitySelector";

export function Header() {
  const { user } = useAuth();
  const { unreadCount } = useUnreadMessages();
  const [, navigate] = useLocation();

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" data-testid="header-logo" className="text-xl font-bold tracking-tight text-rose-600">
          Roomly
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-stone-600 md:flex">
          <Link href="/kamers" data-testid="header-kamers-link" className="transition hover:text-rose-600">
            Woningen
          </Link>
          <CitySelector />
          {user ? (
            <>
              <Link href="/favorieten" data-testid="header-favorites-link" className="transition hover:text-rose-600">
                Favorieten
              </Link>
              <Link href="/berichten" data-testid="header-messages-link" className="relative transition hover:text-rose-600">
                Berichten
                {unreadCount > 0 && (
                  <span
                    data-testid="header-unread-badge"
                    className="absolute -right-3 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/dashboard" className="transition hover:text-rose-600">
                Dashboard
              </Link>
              <Link
                href="/kamers/nieuw"
                data-testid="header-new-listing-link"
                className="rounded-full border border-stone-200 px-4 py-1.5 text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Advertentie plaatsen
              </Link>
              <button
                type="button"
                data-testid="header-signout-button"
                onClick={handleSignOut}
                className="text-sm font-medium text-stone-500 transition hover:text-rose-600"
              >
                Uitloggen
              </button>
            </>
          ) : (
            <>
              <Link href="/inloggen" data-testid="header-login-link" className="transition hover:text-rose-600">
                Inloggen
              </Link>
              <Link
                href="/registreren"
                data-testid="header-register-link"
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 active:scale-95"
              >
                Gratis aanmelden
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <CitySelector />
          {user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
            >
              Uitloggen
            </button>
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
